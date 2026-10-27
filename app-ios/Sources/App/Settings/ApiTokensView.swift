import SwiftUI

/// Settings > API Tokens: bot tokens for an agent, such as an AI coach, to read and manage workouts through the API.
struct ApiTokensView: View {
    @Environment(LocalStore.self) private var store
    @Observe(ApiToken.all) private var tokens
    @State private var naming = false
    @State private var name = ""
    @State private var created: CreatedToken?
    @State private var revoking: ApiToken?

    private var apiURL: String { AppEnvironment.apiURL.appending(path: "api").absoluteString }

    var body: some View {
        Form {
            Section {
                LabeledContent("API", value: apiURL)
                    .font(AppFont.caption(13))
                    .textSelection(.enabled)
            } footer: {
                Text("An agent starts with GET on this URL. Without a token it explains how to authenticate; with one it returns the full guide and every operation.")
            }
            Section {
                ForEach(tokens) { token in
                    VStack(alignment: .leading, spacing: 2) {
                        Text(token.name).font(AppFont.medium(15)).foregroundStyle(Theme.textPrimary)
                        Text("\(token.hint)… · Created \(token.createdAt.formatted(date: .abbreviated, time: .omitted))")
                            .font(AppFont.caption(12))
                            .foregroundStyle(Theme.textSecondary)
                    }
                    .swipeActions {
                        Button("Revoke", role: .destructive) { revoking = token }
                    }
                }
                Button("New Token", systemImage: "plus") {
                    name = ""
                    naming = true
                }
            } header: {
                SectionTitle(tokens.count == 1 ? "1 Token" : "\(tokens.count) Tokens").textCase(nil)
            } footer: {
                Text("A token works once the app has synced. Swipe left to revoke one.")
            }
        }
        .detailTitle("API Tokens")
        .alert("New Token", isPresented: $naming) {
            TextField("Name, e.g. Coach", text: $name)
            Button("Cancel", role: .cancel) {}
            Button("Create") {
                let made = ApiToken.make(name: name.trimmingCharacters(in: .whitespaces).isEmpty ? "Agent" : name)
                store.insert(made.row)
                created = CreatedToken(name: made.row.name, token: made.token, apiURL: apiURL)
            }
        } message: {
            Text("Name it after the agent that will use it.")
        }
        .confirmationDialog(
            "Revoke \(revoking?.name ?? "")?", isPresented: Binding(get: { revoking != nil }, set: { if !$0 { revoking = nil } }),
            titleVisibility: .visible
        ) {
            Button("Revoke", role: .destructive) {
                if let revoking { store.delete(ApiToken.self, id: revoking.id) }
            }
        } message: {
            Text("Agents using it lose access after the next sync.")
        }
        .sheet(item: $created) { CreatedTokenSheet(created: $0) }
    }
}

private struct CreatedToken: Identifiable {
    let name: String
    let token: String
    let apiURL: String

    var id: String { token }

    /// Everything an agent needs pasted into its instructions.
    var setup: String {
        """
        A Better Me API: \(apiURL)
        Token: \(token)
        Send it as the header "Authorization: Bearer \(token)" and start with GET \(apiURL), which returns the guide and every operation.
        """
    }
}

private struct CreatedTokenSheet: View {
    @Environment(\.dismiss) private var dismiss
    let created: CreatedToken
    @State private var copied: String?

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Text(created.token)
                        .font(.system(.footnote, design: .monospaced))
                        .textSelection(.enabled)
                        .accessibilityIdentifier("api-token")
                } footer: {
                    Text("Copy it now. It is shown only once; only its fingerprint is stored.")
                }
                Section {
                    copyButton("Copy Token", value: created.token)
                    copyButton("Copy Setup for an Agent", value: created.setup)
                }
            }
            .detailTitle(created.name)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
            }
        }
        .interactiveDismissDisabled()
    }

    private func copyButton(_ title: String, value: String) -> some View {
        Button(copied == title ? "Copied" : title, systemImage: copied == title ? "checkmark" : "doc.on.doc") {
            UIPasteboard.general.string = value
            copied = title
        }
    }
}
