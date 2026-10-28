import Foundation
import Testing
@testable import App

struct StepSamplesCSVTests {
    @Test func writesOneRowPerSampleWithLocalOffsetsAndQuotedNames() {
        let start = Date(timeIntervalSince1970: 1_792_000_000)
        let samples = [
            StepSample(
                start: start, end: start.addingTimeInterval(60), steps: 112, source: "Stefan's Watch, Ultra",
                bundleID: "com.apple.health.ABC", productType: "Watch7,5", deviceModel: "Watch", userEntered: false
            ),
            StepSample(
                start: start.addingTimeInterval(600), end: start.addingTimeInterval(900), steps: 1234.5, source: "Phone \"main\"",
                bundleID: "com.apple.health.DEF", productType: nil, deviceModel: nil, userEntered: true
            ),
        ]
        let csv = StepSamplesCSV.text(samples, timeZone: TimeZone(identifier: "America/Los_Angeles")!)
        #expect(csv == #"""
        start,end,steps,source,bundle_id,product_type,device_model,user_entered
        2026-10-14T10:46:40-07:00,2026-10-14T10:47:40-07:00,112,"Stefan's Watch, Ultra",com.apple.health.ABC,"Watch7,5",Watch,false
        2026-10-14T10:56:40-07:00,2026-10-14T11:01:40-07:00,1234.5,"Phone ""main""",com.apple.health.DEF,,,true

        """#)
    }
}
