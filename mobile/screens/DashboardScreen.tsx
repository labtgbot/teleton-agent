import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

interface AgentStatus {
  role: string;
  status: 'idle' | 'working' | 'error';
  currentTask?: string;
}

interface Metrics {
  tokenUsage: number;
  successRate: number;
  activeTasks: number;
  uptime: number;
}

export default function DashboardScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [agentsRes, metricsRes] = await Promise.all([
        axios.get(`${API_URL}/api/swarm/status`),
        axios.get(`${API_URL}/api/analytics/metrics`),
      ]);

      setAgents(agentsRes.data.agents || []);
      setMetrics({
        tokenUsage: metricsRes.data.tokenUsage || 0,
        successRate: metricsRes.data.successRate || 0,
        activeTasks: metricsRes.data.activeTasks || 0,
        uptime: metricsRes.data.uptime || 0,
      });
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'working': return '#10b981';
      case 'error': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getRoleIcon = (role: string) => {
    const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
      orchestrator: 'pulse',
      researcher: 'search',
      planner: 'document-text',
      executor: 'bolt',
      critic: 'target',
      security: 'shield-checkmark',
      communicator: 'chatbubble',
      learner: 'book',
    };
    return icons[role.toLowerCase()] || 'robot';
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="hourglass" size={48} color="#3b82f6" />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Teleton Agent</Text>
        <Text style={styles.subtitle}>Mobile Dashboard</Text>
      </View>

      {/* Quick Stats */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Ionicons name="flash" size={24} color="#f59e0b" />
          <Text style={styles.statValue}>{metrics?.tokenUsage.toLocaleString() || 0}</Text>
          <Text style={styles.statLabel}>Tokens Used</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="checkmark-circle" size={24} color="#10b981" />
          <Text style={styles.statValue}>{metrics?.successRate.toFixed(1)}%</Text>
          <Text style={styles.statLabel}>Success Rate</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="list" size={24} color="#3b82f6" />
          <Text style={styles.statValue}>{metrics?.activeTasks || 0}</Text>
          <Text style={styles.statLabel}>Active Tasks</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="time" size={24} color="#8b5cf6" />
          <Text style={styles.statValue}>{Math.floor((metrics?.uptime || 0) / 3600)}h</Text>
          <Text style={styles.statLabel}>Uptime</Text>
        </View>
      </View>

      {/* Agent Status */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Agent Swarm Status</Text>
        {agents.map((agent, index) => (
          <View key={index} style={styles.agentCard}>
            <View style={styles.agentHeader}>
              <Ionicons
                name={getRoleIcon(agent.role)}
                size={28}
                color="#3b82f6"
              />
              <Text style={styles.agentRole}>{agent.role}</Text>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: getStatusColor(agent.status) },
                ]}
              >
                <Text style={styles.statusText}>{agent.status}</Text>
              </View>
            </View>
            {agent.currentTask && (
              <Text style={styles.agentTask} numberOfLines={2}>
                📋 {agent.currentTask}
              </Text>
            )}
          </View>
        ))}
        {agents.length === 0 && (
          <Text style={styles.emptyText}>No agents active</Text>
        )}
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionButtons}>
          <View style={styles.actionButton}>
            <Ionicons name="add-circle" size={24} color="#fff" />
            <Text style={styles.actionText}>New Task</Text>
          </View>
          <View style={styles.actionButton}>
            <Ionicons name="pause" size={24} color="#fff" />
            <Text style={styles.actionText}>Pause</Text>
          </View>
          <View style={styles.actionButton}>
            <Ionicons name="refresh" size={24} color="#fff" />
            <Text style={styles.actionText}>Restart</Text>
          </View>
          <View style={styles.actionButton}>
            <Ionicons name="settings" size={24} color="#fff" />
            <Text style={styles.actionText}>Config</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f1a',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f0f1a',
  },
  loadingText: {
    color: '#6b7280',
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#1a1a2e',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 12,
  },
  statCard: {
    width: (width - 64) / 2,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
    textAlign: 'center',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  agentCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  agentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  agentRole: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  agentTask: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 8,
    lineHeight: 18,
  },
  emptyText: {
    color: '#6b7280',
    textAlign: 'center',
    padding: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionButton: {
    width: (width - 76) / 4,
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
});
