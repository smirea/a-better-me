import SwiftUI

/// More > Sync: the owner token and what the sync client is doing. The token is entered once and kept in the Keychain.
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
                Section {
                    ForEach(store.rejected.indices, id: \.self) { index in
                        let rejection = store.rejected[index]
                        Text("\(rejection.table) \(rejection.id): \(rejection.reason)").font(AppFont.caption())
                    }
                    Button("Dismiss") { store.dismissRejections() }
                } header: {
                    Text("Some rows were refused by the server")
                        .foregroundStyle(Theme.destructive)
                } footer: {
                    Text("The server refused \(store.rejected.count) write(s) and this phone now matches the server. The pre-sync backup file keeps the original rows.")
                }
                .listRowBackground(Theme.destructive.opacity(0.18))
            }
        }
        .navigationTitle("Sync")
    }

    private var footer: String {
        switch store.syncState {
        case .noToken: "Everything stays on this phone until an owner token is saved."
        case .syncing: "Exchanging changes with the server."
        case .connected: "Changes reach your other devices within a second."
        case .offline: "Changes wait on this phone and upload when the server is reachable."
        case let .failed(reason): "The server answered with an error and the app will retry: \(reason)"
        case .badToken: "The server rejected the saved token. Save the right one to sync again."
        }
    }
}
