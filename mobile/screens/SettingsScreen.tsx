import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export default function SettingsScreen() {
  const [settings, setSettings] = useState({
    notifications: true,
    darkMode: true,
    autoRefresh: true,
    soundEnabled: true,
    hapticFeedback: true,
  });

  const toggleSetting = (key: keyof typeof settings) => {
    setSettings(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.removeItem('auth_token');
              // Navigate to login screen (would need navigation context)
              console.log('Logged out');
            } catch (error) {
              console.error('Logout failed:', error);
            }
          },
        },
      ]
    );
  };

  const handleClearCache = () => {
    Alert.alert(
      'Clear Cache',
      'This will clear all cached data. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.clear();
              Alert.alert('Success', 'Cache cleared successfully');
            } catch (error) {
              Alert.alert('Error', 'Failed to clear cache');
            }
          },
        },
      ]
    );
  };

  const SettingItem = ({
    icon,
    title,
    description,
    value,
    onToggle,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    description?: string;
    value: boolean;
    onToggle: () => void;
  }) => (
    <View style={styles.settingItem}>
      <View style={styles.settingLeft}>
        <View style={styles.settingIcon}>
          <Ionicons name={icon} size={24} color="#3b82f6" />
        </View>
        <View style={styles.settingText}>
          <Text style={styles.settingTitle}>{title}</Text>
          {description && (
            <Text style={styles.settingDescription}>{description}</Text>
          )}
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: '#2a2a3e', true: '#3b82f6' }}
        thumbColor={value ? '#fff' : '#6b7280'}
      />
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      {/* Profile Section */}
      <View style={styles.section}>
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Ionicons name="robot" size={40} color="#fff" />
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>Teleton Agent</Text>
            <Text style={styles.profileVersion}>v0.8.5</Text>
          </View>
          <TouchableOpacity style={styles.editButton}>
            <Ionicons name="pencil" size={20} color="#3b82f6" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Preferences */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preferences</Text>
        <View style={styles.card}>
          <SettingItem
            icon="notifications"
            title="Push Notifications"
            description="Receive alerts about agent activity"
            value={settings.notifications}
            onToggle={() => toggleSetting('notifications')}
          />
          <View style={styles.divider} />
          <SettingItem
            icon="moon"
            title="Dark Mode"
            description="Use dark theme throughout the app"
            value={settings.darkMode}
            onToggle={() => toggleSetting('darkMode')}
          />
          <View style={styles.divider} />
          <SettingItem
            icon="refresh"
            title="Auto Refresh"
            description="Automatically refresh data every 30s"
            value={settings.autoRefresh}
            onToggle={() => toggleSetting('autoRefresh')}
          />
          <View style={styles.divider} />
          <SettingItem
            icon="volume-high"
            title="Sound Effects"
            description="Play sounds for notifications"
            value={settings.soundEnabled}
            onToggle={() => toggleSetting('soundEnabled')}
          />
          <View style={styles.divider} />
          <SettingItem
            icon="hand-left"
            title="Haptic Feedback"
            description="Vibrate on interactions"
            value={settings.hapticFeedback}
            onToggle={() => toggleSetting('hapticFeedback')}
          />
        </View>
      </View>

      {/* Connection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Connection</Text>
        <View style={styles.card}>
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <View style={styles.settingIcon}>
                <Ionicons name="server" size={24} color="#3b82f6" />
              </View>
              <View style={styles.settingText}>
                <Text style={styles.settingTitle}>API Endpoint</Text>
                <Text style={styles.settingDescription}>{API_URL}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#6b7280" />
          </View>
          <View style={styles.divider} />
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <View style={styles.settingIcon}>
                <Ionicons name="wifi" size={24} color="#10b981" />
              </View>
              <View style={styles.settingText}>
                <Text style={styles.settingTitle}>Connection Status</Text>
                <Text style={[styles.settingDescription, { color: '#10b981' }]}>
                  Connected
                </Text>
              </View>
            </View>
            <View style={styles.statusIndicator} />
          </View>
        </View>
      </View>

      {/* Data */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Data</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.settingItem} onPress={handleClearCache}>
            <View style={styles.settingLeft}>
              <View style={styles.settingIcon}>
                <Ionicons name="trash" size={24} color="#f59e0b" />
              </View>
              <View style={styles.settingText}>
                <Text style={styles.settingTitle}>Clear Cache</Text>
                <Text style={styles.settingDescription}>
                  Remove all cached data
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#6b7280" />
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <View style={styles.settingIcon}>
                <Ionicons name="download" size={24} color="#3b82f6" />
              </View>
              <View style={styles.settingText}>
                <Text style={styles.settingTitle}>Export Data</Text>
                <Text style={styles.settingDescription}>
                  Backup your settings and history
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#6b7280" />
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <View style={styles.settingIcon}>
                <Ionicons name="upload" size={24} color="#3b82f6" />
              </View>
              <View style={styles.settingText}>
                <Text style={styles.settingTitle}>Import Data</Text>
                <Text style={styles.settingDescription}>
                  Restore from backup file
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#6b7280" />
          </TouchableOpacity>
        </View>
      </View>

      {/* About */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <View style={styles.settingIcon}>
                <Ionicons name="document-text" size={24} color="#3b82f6" />
              </View>
              <View style={styles.settingText}>
                <Text style={styles.settingTitle}>Documentation</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#6b7280" />
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <View style={styles.settingIcon}>
                <Ionicons name="star" size={24} color="#f59e0b" />
              </View>
              <View style={styles.settingText}>
                <Text style={styles.settingTitle}>Rate App</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#6b7280" />
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <View style={styles.settingIcon}>
                <Ionicons name="bug" size={24} color="#ef4444" />
              </View>
              <View style={styles.settingText}>
                <Text style={styles.settingTitle}>Report Issue</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#6b7280" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Logout */}
      <View style={[styles.section, styles.logoutSection]}>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out" size={24} color="#ef4444" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Version */}
      <View style={styles.versionContainer}>
        <Text style={styles.versionText}>Teleton Agent Mobile v0.8.5</Text>
        <Text style={styles.versionSubtext}>Built with ❤️ using React Native</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f1a',
  },
  header: {
    padding: 16,
    paddingTop: 60,
    backgroundColor: '#1a1a2e',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 20,
    gap: 16,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  profileVersion: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
  },
  editButton: {
    padding: 8,
  },
  card: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#3b82f620',
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingText: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  settingDescription: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#2a2a3e',
    marginHorizontal: 16,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10b981',
  },
  logoutSection: {
    paddingBottom: 32,
  },
  logoutButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ef444420',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ef444430',
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ef4444',
  },
  versionContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  versionText: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '600',
  },
  versionSubtext: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 4,
  },
});
