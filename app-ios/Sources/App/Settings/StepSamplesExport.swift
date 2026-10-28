import Foundation
import HealthKit
import SwiftUI

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
    static let header = "start,end,steps,source,bundle_id,product_type,device_model,user_entered\n"

    /// ISO 8601 times with the offset of `timeZone`, so a day can be bucketed the way Health buckets it. Each row ends in
    /// a newline, so batches append straight after the header.
    static func rows(_ samples: [StepSample], timeZone: TimeZone) -> String {
        let time = Date.ISO8601FormatStyle(timeZoneSeparator: .colon, timeZone: timeZone)
        var text = ""
        for sample in samples {
            let steps = sample.steps.rounded() == sample.steps ? String(Int(sample.steps)) : String(sample.steps)
            text += [
                sample.start.formatted(time), sample.end.formatted(time), steps,
                field(sample.source), field(sample.bundleID), field(sample.productType ?? ""), field(sample.deviceModel ?? ""),
                sample.userEntered ? "true" : "false",
            ].joined(separator: ",")
            text += "\n"
        }
        return text
    }

    private static func field(_ value: String) -> String {
        guard value.contains(where: { $0 == "," || $0 == "\"" || $0.isNewline }) else { return value }
        return "\"\(value.replacingOccurrences(of: "\"", with: "\"\""))\""
    }

    static func fileName(at date: Date) -> String {
        "steps-\(DateFormatter.posix("yyyyMMdd-HHmmss").string(from: date)).csv"
    }

    /// Writes every step sample to a temporary file, reading Health one year at a time so a decade of Watch samples
    /// never sits in memory at once and the sheet can report how far it got. Returns the file and its row count.
    @concurrent
    static func write(progress: @escaping @MainActor (Double, Int) -> Void) async throws -> (url: URL, rows: Int) {
        let store = HealthStore.shared
        let type = HKQuantityType(.stepCount)
        let first = try await HKSampleQueryDescriptor(
            predicates: [.quantitySample(type: type)], sortDescriptors: [SortDescriptor(\.startDate)], limit: 1
        ).result(for: store).first?.startDate ?? .now

        let calendar = Calendar.current
        let now = Date.now
        var bounds = [calendar.dateInterval(of: .year, for: first)!.start]
        while bounds.last! <= now { bounds.append(calendar.date(byAdding: .year, value: 1, to: bounds.last!)!) }

        let url = URL.temporaryDirectory.appending(path: fileName(at: now))
        try Data(header.utf8).write(to: url)
        let file = try FileHandle(forWritingTo: url)
        defer { try? file.close() }
        try file.seekToEnd()

        var count = 0
        for (index, (start, end)) in zip(bounds, bounds.dropFirst()).enumerated() {
            try Task.checkCancellation()
            let inYear = NSPredicate(format: "%K >= %@ AND %K < %@", HKPredicateKeyPathStartDate, start as NSDate, HKPredicateKeyPathStartDate, end as NSDate)
            let samples = try await HKSampleQueryDescriptor(
                predicates: [.quantitySample(type: type, predicate: inYear)], sortDescriptors: [SortDescriptor(\.startDate)]
            ).result(for: store).map(StepSample.init)
            try file.write(contentsOf: Data(rows(samples, timeZone: calendar.timeZone).utf8))
            count += samples.count
            await progress(Double(index + 1) / Double(bounds.count - 1), count)
        }
        return (url, count)
    }
}

/// Settings > Apple Health's export: builds the CSV with a progress bar, then offers it to the share sheet. Dismissing
/// the sheet cancels the export.
struct StepSamplesExportSheet: View {
    private enum Phase {
        case running(fraction: Double, rows: Int)
        case done(URL, rows: Int)
        case failed(String)
    }

    @Environment(\.dismiss) private var dismiss
    @State private var phase = Phase.running(fraction: 0, rows: 0)

    var body: some View {
        VStack(spacing: 16) {
            Text("Step Samples").font(AppFont.headline())
            switch phase {
            case let .running(fraction, rows):
                ProgressView(value: fraction)
                Text(rows == 0 ? "Reading Health…" : "\(rows.formatted()) samples")
                    .font(AppFont.rowDetail).foregroundStyle(Theme.textSecondary).monospacedDigit()
                Button("Cancel", role: .cancel) { dismiss() }
                    .secondaryPill()
            case let .done(url, rows):
                Text("\(rows.formatted()) samples").font(AppFont.rowDetail).foregroundStyle(Theme.textSecondary)
                ShareLink(item: url) { Label("Share CSV", systemImage: "square.and.arrow.up") }
                    .primaryPill()
                    .accessibilityLabel("Share CSV")
            case let .failed(message):
                Text(message).font(AppFont.rowDetail).foregroundStyle(Theme.textSecondary).multilineTextAlignment(.center)
                Button("Close") { dismiss() }
                    .secondaryPill()
            }
        }
        .padding(20)
        .presentationDetents([.height(210)])
        .interactiveDismissDisabled(isRunning)
        .task {
            do {
                let result = try await StepSamplesCSV.write { fraction, rows in phase = .running(fraction: fraction, rows: rows) }
                phase = .done(result.url, rows: result.rows)
            } catch is CancellationError {
            } catch {
                phase = .failed("Export failed: \(error.localizedDescription)")
            }
        }
    }

    private var isRunning: Bool {
        if case .running = phase { true } else { false }
    }
}
