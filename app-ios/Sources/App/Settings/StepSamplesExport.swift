import CoreTransferable
import Foundation
import HealthKit
import UniformTypeIdentifiers

/// One raw HealthKit step sample, before Health de-duplicates overlapping iPhone and Watch samples by source priority.
struct StepSample: Equatable, Sendable {
    var start: Date
    var end: Date
    var steps: Double
    var source: String
    var bundleID: String
    var productType: String?
    var deviceModel: String?
    var userEntered: Bool
}

extension StepSample {
    init(_ sample: HKQuantitySample) {
        let revision = sample.sourceRevision
        self.init(
            start: sample.startDate, end: sample.endDate, steps: sample.quantity.doubleValue(for: .count()),
            source: revision.source.name, bundleID: revision.source.bundleIdentifier, productType: revision.productType,
            deviceModel: sample.device?.model, userEntered: sample.metadata?[HKMetadataKeyWasUserEntered] as? Bool ?? false
        )
    }
}

enum StepSamplesCSV {
    static let header = "start,end,steps,source,bundle_id,product_type,device_model,user_entered"

    /// ISO 8601 times with the offset of `timeZone`, so a day can be bucketed the way Health buckets it.
    static func text(_ samples: [StepSample], timeZone: TimeZone) -> String {
        let time = Date.ISO8601FormatStyle(timeZoneSeparator: .colon, timeZone: timeZone)
        var lines = [header]
        lines.reserveCapacity(samples.count + 1)
        for sample in samples {
            lines.append([
                sample.start.formatted(time), sample.end.formatted(time), sample.steps.formatted(.number.grouping(.never).locale(Locale(identifier: "en_US_POSIX"))),
                field(sample.source), field(sample.bundleID), field(sample.productType ?? ""), field(sample.deviceModel ?? ""),
                sample.userEntered ? "true" : "false",
            ].joined(separator: ","))
        }
        return lines.joined(separator: "\n") + "\n"
    }

    private static func field(_ value: String) -> String {
        guard value.contains(where: { $0 == "," || $0 == "\"" || $0.isNewline }) else { return value }
        return "\"\(value.replacingOccurrences(of: "\"", with: "\"\""))\""
    }

    static func fileName(at date: Date) -> String {
        "steps-\(DateFormatter.posix("yyyyMMdd-HHmmss").string(from: date)).csv"
    }
}

/// Every step sample in Health as CSV for `ShareLink`, read only when the share sheet asks for the file.
struct StepSamplesFile: Transferable {
    static var transferRepresentation: some TransferRepresentation {
        FileRepresentation(exportedContentType: .commaSeparatedText) { _ in
            let query = HKSampleQueryDescriptor(
                predicates: [.quantitySample(type: HKQuantityType(.stepCount))],
                sortDescriptors: [SortDescriptor(\.startDate)]
            )
            let samples = try await query.result(for: HealthStore.shared).map(StepSample.init)
            let date = Date.now
            let url = URL.temporaryDirectory.appending(path: StepSamplesCSV.fileName(at: date))
            try Data(StepSamplesCSV.text(samples, timeZone: .current).utf8).write(to: url, options: .atomic)
            return SentTransferredFile(url)
        }
    }
}
