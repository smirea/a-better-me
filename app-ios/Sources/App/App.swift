import SwiftUI

@main
struct StarterApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}

struct ContentView: View {
    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "swift")
                .font(.system(size: 48))
                .foregroundStyle(.orange)
            Text("Hello!")
                .font(.largeTitle)
            Text("Your app is ready to build.")
                .foregroundStyle(.secondary)
        }
        .padding()
    }
}
