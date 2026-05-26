import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  priority: 'low' | 'medium' | 'high';
  createdAt: number;
  completedAt?: number;
}

export default function TasksScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [loading, setLoading] = useState(true);

  const fetchTasks = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/tasks`);
      setTasks(res.data.tasks || []);
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 30000);
    return () => clearInterval(interval);
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchTasks();
  };

  const cancelTask = async (taskId: string) => {
    try {
      await axios.post(`${API_URL}/api/tasks/${taskId}/cancel`);
      fetchTasks();
    } catch (error) {
      console.error('Failed to cancel task:', error);
    }
  };

  const retryTask = async (taskId: string) => {
    try {
      await axios.post(`${API_URL}/api/tasks/${taskId}/retry`);
      fetchTasks();
    } catch (error) {
      console.error('Failed to retry task:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return '#3b82f6';
      case 'completed': return '#10b981';
      case 'failed': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high': return { name: 'arrow-up-circle' as const, color: '#ef4444' };
      case 'medium': return { name: 'remove-circle' as const, color: '#f59e0b' };
      default: return { name: 'arrow-down-circle' as const, color: '#6b7280' };
    }
  };

  const filteredTasks = tasks.filter(task => {
    if (filter === 'active') return ['pending', 'running'].includes(task.status);
    if (filter === 'completed') return ['completed', 'failed'].includes(task.status);
    return true;
  });

  const stats = {
    total: tasks.length,
    active: tasks.filter(t => ['pending', 'running'].includes(t.status)).length,
    completed: tasks.filter(t => t.status === 'completed').length,
    failed: tasks.filter(t => t.status === 'failed').length,
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="hourglass" size={48} color="#3b82f6" />
        <Text style={styles.loadingText}>Loading tasks...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Tasks</Text>
        <TouchableOpacity style={styles.addButton}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{stats.total}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={[styles.statBox, styles.activeStat]}>
          <Text style={[styles.statNumber, { color: '#3b82f6' }]}>{stats.active}</Text>
          <Text style={styles.statLabel}>Active</Text>
        </View>
        <View style={[styles.statBox, styles.completedStat]}>
          <Text style={[styles.statNumber, { color: '#10b981' }]}>{stats.completed}</Text>
          <Text style={styles.statLabel}>Done</Text>
        </View>
        <View style={[styles.statBox, styles.failedStat]}>
          <Text style={[styles.statNumber, { color: '#ef4444' }]}>{stats.failed}</Text>
          <Text style={styles.statLabel}>Failed</Text>
        </View>
      </View>

      {/* Filters */}
      <View style={styles.filters}>
        {(['all', 'active', 'completed'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterButton, filter === f && styles.filterButtonActive]}
            onPress={() => setFilter(f)}
          >
            <Text
              style={[
                styles.filterText,
                filter === f && styles.filterTextActive,
              ]}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Task List */}
      <ScrollView
        style={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
        }
      >
        {filteredTasks.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="list-outline" size={64} color="#6b7280" />
            <Text style={styles.emptyText}>No tasks found</Text>
          </View>
        )}

        {filteredTasks.map((task) => {
          const priorityIcon = getPriorityIcon(task.priority);
          return (
            <View key={task.id} style={styles.taskCard}>
              <View style={styles.taskHeader}>
                <View style={styles.taskTitleRow}>
                  <Ionicons name={priorityIcon.name} size={20} color={priorityIcon.color} />
                  <Text style={styles.taskTitle} numberOfLines={1}>{task.title}</Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(task.status) },
                  ]}
                >
                  <Text style={styles.statusText}>{task.status}</Text>
                </View>
              </View>

              {task.description && (
                <Text style={styles.taskDescription} numberOfLines={2}>
                  {task.description}
                </Text>
              )}

              <View style={styles.taskFooter}>
                <Text style={styles.taskTime}>
                  Created: {new Date(task.createdAt).toLocaleDateString()}
                </Text>
                <View style={styles.taskActions}>
                  {task.status === 'running' && (
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => cancelTask(task.id)}
                    >
                      <Ionicons name="stop-circle-outline" size={20} color="#ef4444" />
                    </TouchableOpacity>
                  )}
                  {task.status === 'failed' && (
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => retryTask(task.id)}
                    >
                      <Ionicons name="refresh-circle-outline" size={20} color="#3b82f6" />
                    </TouchableOpacity>
                  )}
                  {task.status === 'completed' && (
                    <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                  )}
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 60,
    backgroundColor: '#1a1a2e',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  activeStat: {
    borderWidth: 1,
    borderColor: '#3b82f630',
  },
  completedStat: {
    borderWidth: 1,
    borderColor: '#10b98130',
  },
  failedStat: {
    borderWidth: 1,
    borderColor: '#ef444430',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  statLabel: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 4,
  },
  filters: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 16,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#3b82f6',
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  filterTextActive: {
    color: '#fff',
  },
  list: {
    flex: 1,
    paddingHorizontal: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 16,
  },
  taskCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  taskTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  taskDescription: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 12,
    lineHeight: 18,
  },
  taskFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  taskTime: {
    fontSize: 11,
    color: '#6b7280',
  },
  taskActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    padding: 4,
  },
});
