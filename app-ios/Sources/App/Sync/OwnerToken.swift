import Foundation
import Security

/// The owner token that authorizes this device, in the Keychain so it outlives a reinstall. Entered once in More > Sync,
/// or by the Debug launch argument `-syncToken <token>` for simulators.
enum OwnerToken {
    private static let service = "a-better-me-owner-token"
    static let launchArgument = "-syncToken"

    static func read() -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess, let data = item as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    static func write(_ token: String?) {
        SecItemDelete([kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service] as CFDictionary)
        guard let token, !token.isEmpty else { return }
        let item: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecValueData as String: Data(token.utf8),
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock,
        ]
        let status = SecItemAdd(item as CFDictionary, nil)
        if status != errSecSuccess { LocalStore.log.error("Could not store the owner token: \(status)") }
    }

    #if DEBUG
    static func applyLaunchArgument() {
        let arguments = ProcessInfo.processInfo.arguments
        guard let index = arguments.firstIndex(of: launchArgument), arguments.indices.contains(index + 1) else { return }
        write(arguments[index + 1])
    }
    #endif
}
