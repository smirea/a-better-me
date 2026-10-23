import SwiftUI

/// More > Sync: the owner token and what the sync connection is doing. The token is entered once and kept in the Keychain.
struct SyncSettingsView: View {
    @Environment(LocalStore.self) private var store
    @State private var token = ""

    var body: some View {
        Form {
            Section {
                LabeledContent("Status", value: store.syncState.title)
                LabeledContent("Pending uploads", value: store.pendingUploads.formatted())
                if let lastSyncedAt = store.lastSyncedAt {
                    LabeledContent("Last synced", value: lastSyncedAt.formatted(date: .abbreviated, time: .shortened))
                }
                LabeledContent("Server", value: AppEnvironment.apiURL.absoluteString)
                    .lineLimit(1)
                    .truncationMode(.middle)
            } header: {
                Text("Connection")
            } footer: {
                Text(footer)
            }
            Section("Owner Token") {
                SecureField("Owner token", text: $token)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .accessibilityLabel("Owner token")
                Button("Save Token") { store.setToken(token.trimmingCharacters(in: .whitespacesAndNewlines)) }
                    .disabled(token.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                if store.hasToken {
                    Button("Forget Token", role: .destructive) {
                        token = ""
                        store.setToken(nil)
                    }
                }
            }
            if !store.rejected.isEmpty {
                Section("Refused by the server") {
                    ForEach(store.rejected, id: \.self) { Text($0).font(AppFont.caption()) }
                }
            }
        }
        .navigationTitle("Sync")
    }

    private var footer: String {
        switch store.syncState {
        case .noToken: "Everything stays on this phone until an owner token is saved."
        case .connecting: "Reaching the server."
        case .connected: "Changes reach your other devices within a second."
        case .offline: "Changes wait on this phone and upload when the server is reachable."
        case .syncOff: "This server runs without PowerSync. Everything stays on this phone, and the app asks again now and then."
        case .badToken: "The server rejected the saved token. Save the right one to sync again."
        }
    }
}
