import Feedback
import SwiftUI

/// New Ping and Edit Ping in one form: the name, the icon, whether it is a boolean or a range, and a range's steps with
/// an optional label each.
struct PingEditor: View {
    private enum Kind: String, CaseIterable {
        case boolean = "Boolean", range = "Range"
    }

    private let editing: Ping?
    @Environment(LocalStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var name: String
    @State private var icon: String
    @State private var kind: Kind
    /// Kept at the most steps a range can have, so labels survive lowering and raising the count.
    @State private var labels: [String]
    @State private var stepCount: Int
    @State private var confirmingDelete = false
    @FocusState private var nameFocused: Bool
    @Observe private var isLogged: Bool

    init(ping: Ping? = nil) {
        editing = ping
        _isLogged = Observe(PingLog.exists(for: ping?.id))
        let steps = ping?.kind.steps ?? []
        _name = State(initialValue: ping?.name ?? "")
        _icon = State(initialValue: ping?.icon ?? PingIcons.all[0])
        _kind = State(initialValue: steps.isEmpty ? .boolean : .range)
        _stepCount = State(initialValue: steps.isEmpty ? 5 : steps.count)
        _labels = State(initialValue: steps + Array(repeating: "", count: PingKind.stepLimits.upperBound - steps.count))
    }

    private var trimmedName: String { name.trimmingCharacters(in: .whitespacesAndNewlines) }

    var body: some View {
        NavigationStack {
            Form {
                ThemedSection(footer: isLogged ? "Its type and number of steps are fixed, so what is already logged keeps its meaning." : nil) {
                    TextField("Name", text: $name)
                        .focused($nameFocused)
                        .accessibilityLabel("Ping Name")
                    Picker("Type", selection: $kind) {
                        ForEach(Kind.allCases, id: \.self) { Text($0.rawValue).tag($0) }
                    }
                    .pickerStyle(.segmented)
                    .disabled(isLogged)
                }
                ThemedSection("Icon") {
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 0), count: 7), spacing: 4) {
                        ForEach(PingIcons.all, id: \.self) { symbol in
                            Button { icon = symbol } label: {
                                Image(systemName: symbol)
                                    .font(.system(size: 17, weight: .semibold))
                                    .foregroundStyle(icon == symbol ? Theme.onPrimary : Theme.textPrimary)
                                    .frame(width: 38, height: 38)
                                    .background(icon == symbol ? Theme.textPrimary : Color.clear, in: .circle)
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel(symbol)
                            .accessibilityAddTraits(icon == symbol ? .isSelected : [])
                        }
                    }
                }
                if kind == .range {
                    ThemedSection("Steps", footer: "A label is optional, such as Terrible for 1 and Great for 5.") {
                        if isLogged {
                            Text("\(stepCount) steps")
                        } else {
                            Stepper("\(stepCount) steps", value: $stepCount, in: PingKind.stepLimits)
                        }
                        ForEach(0..<stepCount, id: \.self) { index in
                            HStack(spacing: 12) {
                                Text("\(index + 1)").font(AppFont.number(15)).foregroundStyle(Theme.textSecondary).frame(width: 24)
                                TextField("Label", text: $labels[index]).accessibilityLabel("Step \(index + 1) label")
                            }
                        }
                    }
                }
                if editing != nil {
                    ThemedSection {
                        Button("Delete Ping", systemImage: "trash", role: .destructive) { confirmingDelete = true }
                            .foregroundStyle(Theme.destructive)
                    }
                }
            }
            .themedList()
            .scrollDismissesKeyboard(.interactively)
            .detailTitle(editing != nil ? "Edit Ping" : "New Ping")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(role: .close) { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(role: .confirm) { save() }.disabled(trimmedName.isEmpty)
                }
            }
            .alert("Delete Ping", isPresented: $confirmingDelete) {
                Button("Delete", role: .destructive) {
                    if let editing { store.deletePing(editing.id) }
                    dismiss()
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("Are you sure you want to delete \(trimmedName)? Everything logged for it goes too. This action cannot be undone.")
            }
            .onAppear { nameFocused = editing == nil }
        }
        .feedback(self)
    }

    private func save() {
        let steps = labels.prefix(stepCount).map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
        var ping = editing ?? Ping(name: "", icon: icon, kind: .boolean)
        ping.name = trimmedName
        ping.icon = icon
        ping.kind = kind == .range ? .range(steps) : .boolean
        store.savePing(ping)
        dismiss()
    }
}

/// The symbols a ping can take, grouped loosely: feelings, body, food and drink, activity, and the rest.
enum PingIcons {
    static let all = [
        "face.smiling", "heart", "brain.head.profile", "bolt", "battery.75percent", "moon.zzz", "bed.double",
        "drop", "cup.and.saucer", "wineglass", "fork.knife", "pills", "cross.case", "toilet",
        "figure.walk", "figure.run", "figure.mind.and.body", "dumbbell", "lungs", "thermometer.medium", "bandage",
        "sun.max", "cloud.rain", "leaf", "flame", "snowflake", "eye", "ear",
        "book", "gamecontroller", "tv", "iphone", "briefcase", "house", "car",
        "person.2", "pawprint", "shower", "sparkles", "star", "checkmark.circle", "circle",
    ]
}
