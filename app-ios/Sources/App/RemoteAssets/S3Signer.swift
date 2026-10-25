import CryptoKit
import Foundation

struct S3Credentials: Equatable, Sendable {
    let accessKeyID: String
    let secretAccessKey: String
}

/// AWS Signature Version 4 for bodiless requests, which is all R2's S3 API needs for downloads. Signs every header the
/// request carries, plus `host`, `x-amz-date`, and `x-amz-content-sha256`.
enum S3Signer {
    static let emptyPayloadHash = SHA256.hash(data: Data()).hex

    static func sign(_ request: URLRequest, credentials: S3Credentials, region: String, date: Date) -> URLRequest {
        guard let url = request.url, let host = url.host() else { preconditionFailure("S3 requests need an absolute URL") }
        let (timestamp, day) = timestamps(date)
        var signed = request
        signed.setValue(timestamp, forHTTPHeaderField: "x-amz-date")
        signed.setValue(emptyPayloadHash, forHTTPHeaderField: "x-amz-content-sha256")
        var headers = ["host": url.port.map { "\(host):\($0)" } ?? host]
        for (name, value) in signed.allHTTPHeaderFields ?? [:] where name.lowercased() != "authorization" {
            headers[name.lowercased()] = value.split(separator: " ", omittingEmptySubsequences: true).joined(separator: " ")
        }
        let names = headers.keys.sorted()
        let signedHeaders = names.joined(separator: ";")
        let canonicalRequest = [
            request.httpMethod ?? "GET",
            canonicalPath(url),
            canonicalQuery(url),
            names.map { "\($0):\(headers[$0]!)\n" }.joined(),
            signedHeaders,
            emptyPayloadHash,
        ].joined(separator: "\n")
        let scope = "\(day)/\(region)/s3/aws4_request"
        let stringToSign = ["AWS4-HMAC-SHA256", timestamp, scope, SHA256.hash(data: Data(canonicalRequest.utf8)).hex]
            .joined(separator: "\n")
        var key = SymmetricKey(data: Data("AWS4\(credentials.secretAccessKey)".utf8))
        for part in [day, region, "s3", "aws4_request"] {
            key = SymmetricKey(data: Data(HMAC<SHA256>.authenticationCode(for: Data(part.utf8), using: key)))
        }
        let signature = HMAC<SHA256>.authenticationCode(for: Data(stringToSign.utf8), using: key).hex
        signed.setValue(
            "AWS4-HMAC-SHA256 Credential=\(credentials.accessKeyID)/\(scope), SignedHeaders=\(signedHeaders), Signature=\(signature)",
            forHTTPHeaderField: "Authorization"
        )
        return signed
    }

    private static func timestamps(_ date: Date) -> (timestamp: String, day: String) {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = .gmt
        let c = calendar.dateComponents([.year, .month, .day, .hour, .minute, .second], from: date)
        let day = String(format: "%04d%02d%02d", c.year!, c.month!, c.day!)
        return (day + String(format: "T%02d%02d%02dZ", c.hour!, c.minute!, c.second!), day)
    }

    /// S3 encodes the path once, keeping its slashes, unlike the other AWS services.
    private static func canonicalPath(_ url: URL) -> String {
        let path = url.path(percentEncoded: false)
        return path.isEmpty ? "/" : encode(path, keepingSlashes: true)
    }

    private static func canonicalQuery(_ url: URL) -> String {
        let items = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems ?? []
        return items
            .map { (encode($0.name, keepingSlashes: false), encode($0.value ?? "", keepingSlashes: false)) }
            .sorted { $0 < $1 }
            .map { "\($0)=\($1)" }
            .joined(separator: "&")
    }

    private static func encode(_ text: String, keepingSlashes: Bool) -> String {
        text.utf8.map { byte in
            let char = Character(UnicodeScalar(byte))
            let unreserved = char.isASCII && (char.isLetter || char.isNumber || "-._~".contains(char))
            return unreserved || (keepingSlashes && char == "/") ? String(char) : String(format: "%%%02X", byte)
        }.joined()
    }
}

extension Sequence where Element == UInt8 {
    var hex: String { map { String(format: "%02x", $0) }.joined() }
}
