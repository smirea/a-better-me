import Foundation

/// The phone's own step count from Core Motion. Unlike Health it stays readable while the phone is locked, and it
/// counts as the owner walks, while Health takes the phone's steps in batches. It counts only steps the phone felt.
enum PhonePedometer {
    /// Health's daily counts with today raised to the phone's count when the phone has counted more.
    static func merge(_ phone: Double?, into health: [DatedValue], today: Date) -> [DatedValue] {
        guard let phone else { return health }
        guard let index = health.firstIndex(where: { $0.date == today }) else { return health + [DatedValue(date: today, value: phone)] }
        var merged = health
        merged[index].value = max(merged[index].value, phone)
        return merged
    }
}
