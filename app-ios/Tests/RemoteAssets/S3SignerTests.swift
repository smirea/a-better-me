import Foundation
import Testing
@testable import App

struct S3SignerTests {
    /// AWS's published GET Object example from the Signature Version 4 header-based authentication docs.
    @Test func awsGetObjectVector() {
        var request = URLRequest(url: URL(string: "https://examplebucket.s3.amazonaws.com/test.txt")!)
        request.setValue("bytes=0-9", forHTTPHeaderField: "Range")
        let signed = S3Signer.sign(
            request,
            credentials: S3Credentials(accessKeyID: "AKIAIOSFODNN7EXAMPLE", secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"),
            region: "us-east-1",
            date: Date(timeIntervalSince1970: 1_369_353_600)
        )
        #expect(signed.value(forHTTPHeaderField: "Authorization") == "AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request, SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41")
        #expect(signed.value(forHTTPHeaderField: "x-amz-date") == "20130524T000000Z")
        #expect(signed.value(forHTTPHeaderField: "x-amz-content-sha256") == "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
    }
}
