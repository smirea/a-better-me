import Foundation

extension Int {
    /// "1:30", for rest timers and timed sets.
    var minuteSecond: String { Duration.seconds(self).formatted(.time(pattern: .minuteSecond)) }
}

extension TimeInterval {
    /// A countdown's "1:30", rounded up so it reads 0:00 only once time is up.
    var countdown: String { Duration.seconds(rounded(.up)).formatted(.time(pattern: .minuteSecond)) }
}
