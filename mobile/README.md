# Teleton Agent Mobile App

Native mobile application for Teleton Agent built with React Native and Expo.

## 🚀 Features

- **Dashboard**: Real-time monitoring of agent swarm status, metrics, and quick actions
- **Chat**: Direct messaging interface with the AI agent
- **Tasks**: Manage and monitor scheduled tasks with filters and actions
- **Settings**: Configure app preferences, notifications, and connection settings

## 📱 Screenshots

### Dashboard
- Agent swarm status visualization
- Token usage, success rate, active tasks, uptime metrics
- Quick action buttons

### Chat
- Real-time conversation with AI agent
- Message history with timestamps
- Typing indicators
- Clear chat functionality

### Tasks
- Task list with status filtering (All, Active, Completed)
- Task statistics overview
- Cancel/retry actions for running/failed tasks
- Pull-to-refresh

### Settings
- Toggle preferences (notifications, dark mode, auto-refresh, sounds, haptics)
- Connection status monitoring
- Data management (clear cache, export/import)
- About section with documentation links

## 🛠️ Tech Stack

- **React Native** 0.73.0
- **Expo** ~50.0.0
- **TypeScript** 5.1+
- **React Navigation** 6.x
- **Axios** for API communication
- **AsyncStorage** for local data persistence

## 📦 Installation

### Prerequisites

- Node.js 18+
- npm or yarn
- Expo CLI
- iOS Simulator (macOS) or Android Emulator

### Setup

```bash
# Install dependencies
npm install

# Start Expo development server
npm start

# Run on iOS
npm run ios

# Run on Android
npm run android

# Run on web browser
npm run web
```

## 🔧 Configuration

Create a `.env` file in the root directory:

```env
EXPO_PUBLIC_API_URL=http://your-teleton-agent-server:3000
```

## 🏗️ Project Structure

```
mobile/
├── App.tsx                 # Main app entry with navigation
├── package.json            # Dependencies and scripts
├── assets/                 # Images and icons
│   ├── icon.png
│   ├── adaptive-icon.png
│   ├── splash.png
│   └── favicon.png
└── screens/
    ├── DashboardScreen.tsx # Main dashboard with metrics
    ├── ChatScreen.tsx      # Chat interface
    ├── TasksScreen.tsx     # Task management
    └── SettingsScreen.tsx  # App settings
```

## 📲 Building for Production

### Android

```bash
# Build APK
npm run build:android

# Submit to Google Play
npm run submit:android
```

### iOS

```bash
# Build IPA
npm run build:ios

# Submit to App Store
npm run submit:ios
```

## 🔐 Security

- Secure storage for authentication tokens
- HTTPS enforcement for API communication
- No sensitive data in logs
- Biometric authentication ready (can be added)

## 🧪 Testing

```bash
# Run tests (when implemented)
npm test

# Run linting
npm run lint
```

## 📝 API Integration

The mobile app communicates with the Teleton Agent backend via REST API:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/swarm/status` | GET | Get agent swarm status |
| `/api/analytics/metrics` | GET | Get usage metrics |
| `/api/sessions/current` | GET/DELETE | Load/clear chat session |
| `/api/agent/chat` | POST | Send message to agent |
| `/api/tasks` | GET | Get task list |
| `/api/tasks/:id/cancel` | POST | Cancel running task |
| `/api/tasks/:id/retry` | POST | Retry failed task |

## 🎨 Design System

### Colors

```typescript
const colors = {
  background: '#0f0f1a',
  card: '#1a1a2e',
  primary: '#3b82f6',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  text: '#ffffff',
  textMuted: '#6b7280',
};
```

### Typography

- Headers: Bold, 24-28px
- Body: Regular, 15-16px
- Captions: Regular, 11-13px

## 🚧 Roadmap

- [ ] Push notifications for agent alerts
- [ ] Biometric authentication
- [ ] Offline mode with sync
- [ ] Widget support (iOS/Android)
- [ ] Voice input for chat
- [ ] Multi-language support
- [ ] Dark/Light theme toggle
- [ ] Tablet optimization

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- Built with [Expo](https://expo.dev/)
- Icons by [Ionicons](https://ionic.io/ionicons)
- Navigation by [React Navigation](https://reactnavigation.org/)

---

**Version:** 0.8.5  
**Last Updated:** 2026-01-25
