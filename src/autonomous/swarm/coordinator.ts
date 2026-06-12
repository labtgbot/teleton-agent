/**
 * Multi-Agent Swarm Coordinator
 * Координация специализированных агентов и достижение консенсуса
 * Фаза 4: Agent Swarm Architecture
 */

import { randomUUID } from 'crypto';
import {
  AgentRole,
  AgentStatus,
  AgentMessage,
  AgentVote,
  Proposal,
  ConsensusMethod,
  ConsensusResult,
  AgentConfig,
  SwarmConfig,
  SwarmMetrics,
  AgentTask,
} from '../../types/swarm/agent-swarm.js';
import { Logger } from '../../utils/logger.js';

interface AgentInstance {
  id: string;
  role: AgentRole;
  config: AgentConfig;
  status: AgentStatus;
  currentTask?: AgentTask;
  lastActive: number;
}

export class SwarmCoordinator {
  private agents: Map<string, AgentInstance> = new Map();
  private messages: AgentMessage[] = [];
  private proposals: Map<string, Proposal> = new Map();
  private votes: Map<string, AgentVote[]> = new Map();
  private tasks: Map<string, AgentTask> = new Map();
  private config: SwarmConfig;
  private logger: Logger;
  private messageListeners: Set<(message: AgentMessage) => void> = new Set();

  constructor(config: Partial<SwarmConfig> = {}) {
    this.config = {
      enabled: true,
      agents: this.getDefaultAgentConfigs(),
      consensusTimeout: 30000,
      debateRounds: 3,
      quorumPercentage: 60,
      messageQueueSize: 1000,
      enableLogging: true,
      logLevel: 'info',
      ...config,
    };

    this.logger = new Logger('SwarmCoordinator');
    this.initializeAgents();
  }

  /**
   * Конфигурации агентов по умолчанию
   */
  private getDefaultAgentConfigs(): AgentConfig[] {
    return [
      { role: AgentRole.ORCHESTRATOR, enabled: true, priority: 10, maxConcurrentTasks: 5, temperature: 0.7 },
      { role: AgentRole.RESEARCHER, enabled: true, priority: 7, maxConcurrentTasks: 3, temperature: 0.7 },
      { role: AgentRole.PLANNER, enabled: true, priority: 8, maxConcurrentTasks: 2, temperature: 0.7 },
      { role: AgentRole.EXECUTOR, enabled: true, priority: 6, maxConcurrentTasks: 5, temperature: 0.7 },
      { role: AgentRole.CRITIC, enabled: true, priority: 9, maxConcurrentTasks: 3, temperature: 0.7 },
      { role: AgentRole.SECURITY, enabled: true, priority: 10, maxConcurrentTasks: 10, temperature: 0.7 },
      { role: AgentRole.COMMUNICATOR, enabled: true, priority: 7, maxConcurrentTasks: 5, temperature: 0.7 },
      { role: AgentRole.LEARNER, enabled: true, priority: 5, maxConcurrentTasks: 2, temperature: 0.7 },
    ];
  }

  /**
   * Инициализация агентов
   */
  private initializeAgents(): void {
    this.config.agents.forEach(agentConfig => {
      if (!agentConfig.enabled) return;

      const agent: AgentInstance = {
        id: randomUUID(),
        role: agentConfig.role,
        config: agentConfig,
        status: AgentStatus.IDLE,
        lastActive: Date.now(),
      };

      this.agents.set(agent.id, agent);
      this.logger.info(`Initialized agent: ${agentConfig.role} (${agent.id})`);
    });

    this.logger.info(`Swarm initialized with ${this.agents.size} agents`);
  }

  /**
   * Отправка сообщения между агентами
   */
  sendMessage(
    from: AgentRole,
    to: AgentRole | 'all',
    type: AgentMessage['type'],
    content: Record<string, unknown>,
    options?: {
      priority?: number;
      requiresResponse?: boolean;
      timeout?: number;
    }
  ): AgentMessage {
    const message: AgentMessage = {
      id: randomUUID(),
      from,
      to,
      type,
      content,
      timestamp: Date.now(),
      priority: options?.priority || 5,
      requiresResponse: options?.requiresResponse || false,
      timeout: options?.timeout,
      threadId: randomUUID(),
    };

    // Ограничение размера очереди
    if (this.messages.length >= this.config.messageQueueSize) {
      this.messages.shift(); // Удаляем старейшее сообщение
    }

    this.messages.push(message);
    this.notifyMessageListeners(message);

    this.logger.debug(`Message sent: ${from} → ${to}`, {
      type: message.type,
      messageId: message.id,
    });

    return message;
  }

  /**
   * Создание предложения для голосования
   */
  createProposal(
    proposer: AgentRole,
    title: string,
    description: string,
    type: Proposal['type'],
    content: Record<string, unknown>,
    consensusMethod: ConsensusMethod = ConsensusMethod.MAJORITY_VOTE
  ): Proposal {
    const proposal: Proposal = {
      id: randomUUID(),
      title,
      description,
      proposer,
      type,
      content,
      status: 'active',
      votes: [],
      createdAt: Date.now(),
      expiresAt: Date.now() + this.config.consensusTimeout,
      requiredConsensus: consensusMethod,
      minVotes: Math.ceil(this.agents.size * (this.config.quorumPercentage / 100)),
    };

    this.proposals.set(proposal.id, proposal);
    this.votes.set(proposal.id, []);

    // Уведомление всех агентов о новом предложении
    this.sendMessage(
      proposer,
      'all',
      'proposal',
      {
        proposalId: proposal.id,
        title: proposal.title,
        description: proposal.description,
        deadline: proposal.expiresAt,
      },
      { priority: 8, requiresResponse: true }
    );

    this.logger.info(`Proposal created: ${title} by ${proposer}`);

    return proposal;
  }

  /**
   * Голосование за предложение
   */
  vote(
    agentId: string,
    proposalId: string,
    vote: 'yes' | 'no' | 'abstain',
    confidence: number,
    rationale?: string
  ): AgentVote {
    const agent = this.agents.get(agentId);
    const proposal = this.proposals.get(proposalId);

    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    if (!proposal) {
      throw new Error(`Proposal ${proposalId} not found`);
    }

    if (proposal.status !== 'active' && proposal.status !== 'voting') {
      throw new Error(`Proposal ${proposalId} is not accepting votes`);
    }

    const agentVote: AgentVote = {
      agentId,
      agentRole: agent.role,
      proposalId,
      vote,
      confidence,
      rationale,
      timestamp: Date.now(),
      weight: this.calculateVoteWeight(agent),
    };

    const proposalVotes = this.votes.get(proposalId) || [];
    proposalVotes.push(agentVote);
    this.votes.set(proposalId, proposalVotes);

    // Обновление списка голосов в предложении
    proposal.votes.push(agentVote.agentId);

    this.logger.debug(`Vote recorded: ${agent.role} voted ${vote} on ${proposal.title}`);

    // Проверка достижения консенсуса
    const consensus = this.checkConsensus(proposalId);
    if (consensus.achieved) {
      this.finalizeProposal(proposalId, consensus);
    }

    return agentVote;
  }

  /**
   * Расчет веса голоса агента
   */
  private calculateVoteWeight(agent: AgentInstance): number {
    // Вес на основе приоритета роли и статуса
    const baseWeight = agent.config.priority / 10;
    const statusMultiplier = agent.status === AgentStatus.ERROR ? 0.5 : 1;
    return baseWeight * statusMultiplier;
  }

  /**
   * Проверка достижения консенсуса
   */
  private checkConsensus(proposalId: string): ConsensusResult {
    const proposal = this.proposals.get(proposalId);
    const votes = this.votes.get(proposalId) || [];

    if (!proposal) {
      throw new Error(`Proposal ${proposalId} not found`);
    }

    const result: ConsensusResult = {
      proposalId,
      method: proposal.requiredConsensus,
      achieved: false,
      votes,
      result: 'accepted',
      summary: '',
      timestamp: Date.now(),
    };

    // Проверка по методу консенсуса
    switch (proposal.requiredConsensus) {
      case ConsensusMethod.MAJORITY_VOTE:
        this.applyMajorityVote(votes, result);
        break;
      case ConsensusMethod.WEIGHTED_VOTE:
        this.applyWeightedVote(votes, result);
        break;
      case ConsensusMethod.UNANIMOUS:
        this.applyUnanimous(votes, result);
        break;
      case ConsensusMethod.DEBATE:
        // Дебаты требуют специальных раундов
        this.applyDebate(votes, result);
        break;
      case ConsensusMethod.TIMEOUT:
        // Таймаут - решение по большинству доступных голосов
        this.applyTimeout(proposal, votes, result);
        break;
    }

    return result;
  }

  /**
   * Метод большинства голосов
   */
  private applyMajorityVote(votes: AgentVote[], result: ConsensusResult): void {
    const yesVotes = votes.filter(v => v.vote === 'yes').length;
    const noVotes = votes.filter(v => v.vote === 'no').length;
    
    if (yesVotes > noVotes) {
      result.achieved = true;
      result.result = 'accepted';
      result.summary = `Accepted by majority: ${yesVotes} yes, ${noVotes} no`;
    } else if (noVotes > yesVotes) {
      result.achieved = true;
      result.result = 'rejected';
      result.summary = `Rejected by majority: ${noVotes} no, ${yesVotes} yes`;
    }

    this.recordDissentingOpinions(votes, result);
  }

  /**
   * Метод взвешенных голосов
   */
  private applyWeightedVote(votes: AgentVote[], result: ConsensusResult): void {
    const yesWeight = votes
      .filter(v => v.vote === 'yes')
      .reduce((sum, v) => sum + v.weight, 0);
    
    const noWeight = votes
      .filter(v => v.vote === 'no')
      .reduce((sum, v) => sum + v.weight, 0);

    if (yesWeight > noWeight) {
      result.achieved = true;
      result.result = 'accepted';
      result.summary = `Accepted by weighted vote: ${yesWeight.toFixed(2)} vs ${noWeight.toFixed(2)}`;
    } else if (noWeight > yesWeight) {
      result.achieved = true;
      result.result = 'rejected';
      result.summary = `Rejected by weighted vote: ${noWeight.toFixed(2)} vs ${yesWeight.toFixed(2)}`;
    }

    this.recordDissentingOpinions(votes, result);
  }

  /**
   * Метод единогласия
   */
  private applyUnanimous(votes: AgentVote[], result: ConsensusResult): void {
    const hasNo = votes.some(v => v.vote === 'no');
    const allVoted = votes.length >= this.agents.size;

    if (allVoted && !hasNo) {
      result.achieved = true;
      result.result = 'accepted';
      result.summary = 'Accepted unanimously';
    } else if (hasNo) {
      result.achieved = true;
      result.result = 'rejected';
      result.summary = 'Rejected: not unanimous';
      this.recordDissentingOpinions(votes, result);
    }
  }

  /**
   * Метод дебатов
   */
  private applyDebate(votes: AgentVote[], result: ConsensusResult): void {
    // Упрощенная реализация - после дебатов применяется большинство
    this.applyMajorityVote(votes, result);
    if (result.achieved) {
      result.summary = `Accepted after debate rounds: ${result.summary}`;
    }
  }

  /**
   * Метод таймаута
   */
  private applyTimeout(
    proposal: Proposal,
    votes: AgentVote[],
    result: ConsensusResult
  ): void {
    const isExpired = Date.now() >= proposal.expiresAt;
    
    if (isExpired) {
      const yesVotes = votes.filter(v => v.vote === 'yes').length;
      const noVotes = votes.filter(v => v.vote === 'no').length;
      
      result.achieved = true;
      result.result = yesVotes >= noVotes ? 'accepted' : 'rejected';
      result.summary = `Decision by timeout: ${yesVotes} yes, ${noVotes} no`;
      
      this.recordDissentingOpinions(votes, result);
    }
  }

  /**
   * Запись несогласных мнений
   */
  private recordDissentingOpinions(votes: AgentVote[], result: ConsensusResult): void {
    const dissenting = votes.filter(v => v.vote === 'no' && v.rationale);
    
    if (dissenting.length > 0) {
      result.dissentingOpinions = dissenting.map(v => ({
        agentRole: v.agentRole,
        rationale: v.rationale!,
      }));
    }
  }

  /**
   * Финализация предложения
   */
  private finalizeProposal(proposalId: string, consensus: ConsensusResult): void {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) return;

    proposal.status = consensus.result === 'accepted' ? 'accepted' : 'rejected';
    
    this.logger.info(`Proposal finalized: ${proposal.title} - ${consensus.result}`, {
      summary: consensus.summary,
      dissentingCount: consensus.dissentingOpinions?.length || 0,
    });

    // Уведомление о результате
    this.sendMessage(
      proposal.proposer,
      'all',
      'result',
      {
        proposalId,
        result: consensus.result,
        summary: consensus.summary,
      }
    );
  }

  /**
   * Назначение задачи агенту
   */
  assignTask(
    role: AgentRole,
    description: string,
    input: Record<string, unknown>,
    priority: number = 5
  ): AgentTask {
    const availableAgent = this.findAvailableAgent(role);
    
    if (!availableAgent) {
      throw new Error(`No available agent for role: ${role}`);
    }

    const task: AgentTask = {
      id: randomUUID(),
      assignedTo: role,
      description,
      input,
      status: 'pending',
      priority,
      createdAt: Date.now(),
    };

    this.tasks.set(task.id, task);
    availableAgent.currentTask = task;
    availableAgent.status = AgentStatus.BUSY;

    // Отправка задачи агенту
    this.sendMessage(
      AgentRole.ORCHESTRATOR,
      role,
      'request',
      { taskId: task.id, task },
      { priority }
    );

    this.logger.info(`Task assigned: ${description} to ${role}`);

    return task;
  }

  /**
   * Поиск доступного агента по роли
   */
  private findAvailableAgent(role: AgentRole): AgentInstance | null {
    for (const agent of this.agents.values()) {
      if (
        agent.role === role &&
        agent.status !== AgentStatus.OFFLINE &&
        agent.status !== AgentStatus.ERROR
      ) {
        // Проверка лимита задач
        const activeTasks = Array.from(this.tasks.values()).filter(
          t => t.assignedTo === role && t.status === 'in_progress'
        ).length;

        if (activeTasks < agent.config.maxConcurrentTasks) {
          return agent;
        }
      }
    }
    return null;
  }

  /**
   * Обновление статуса задачи
   */
  updateTaskStatus(
    taskId: string,
    status: AgentTask['status'],
    output?: Record<string, unknown>,
    error?: string
  ): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.status = status;
    if (output) task.output = output;
    if (error) task.error = error;

    if (status === 'completed' || status === 'failed') {
      task.completedAt = Date.now();
      
      // Освобождение агента
      const agent = Array.from(this.agents.values()).find(
        a => a.currentTask?.id === taskId
      );
      if (agent) {
        agent.status = AgentStatus.IDLE;
        agent.currentTask = undefined;
      }
    } else if (status === 'in_progress') {
      task.startedAt = Date.now();
    }

    this.logger.debug(`Task ${taskId} status updated: ${status}`);
  }

  /**
   * Подписка на сообщения
   */
  subscribeToMessages(callback: (message: AgentMessage) => void): () => void {
    this.messageListeners.add(callback);
    return () => this.messageListeners.delete(callback);
  }

  /**
   * Уведомление слушателей о сообщении
   */
  private notifyMessageListeners(message: AgentMessage): void {
    this.messageListeners.forEach(listener => {
      try {
        listener(message);
      } catch (error) {
        this.logger.error('Error in message listener', error);
      }
    });
  }

  /**
   * Получение статистики swarm
   */
  getMetrics(): SwarmMetrics {
    const agentsArray = Array.from(this.agents.values());
    const activeAgents = agentsArray.filter(
      a => a.status !== AgentStatus.OFFLINE && a.status !== AgentStatus.ERROR
    ).length;

    const completedTasks = Array.from(this.tasks.values()).filter(
      t => t.status === 'completed'
    );
    const failedTasks = Array.from(this.tasks.values()).filter(
      t => t.status === 'failed'
    );

    const byRole: SwarmMetrics['byRole'] = {} as any;
    
    Object.values(AgentRole).forEach(role => {
      const roleTasks = completedTasks.filter(t => t.assignedTo === role);
      const roleFailed = failedTasks.filter(t => t.assignedTo === role);
      const total = roleTasks.length + roleFailed.length;
      
      byRole[role] = {
        tasksCompleted: roleTasks.length,
        successRate: total > 0 ? roleTasks.length / total : 0,
        averageResponseTime: 0, // TODO: Calculate from task timestamps
      };
    });

    return {
      totalAgents: this.agents.size,
      activeAgents,
      messagesProcessed: this.messages.length,
      proposalsCreated: this.proposals.size,
      consensusReached: Array.from(this.proposals.values()).filter(
        p => p.status === 'accepted' || p.status === 'rejected'
      ).length,
      averageConsensusTime: 0, // TODO: Calculate
      tasksCompleted: completedTasks.length,
      successRate: completedTasks.length + failedTasks.length > 0
        ? completedTasks.length / (completedTasks.length + failedTasks.length)
        : 0,
      byRole,
    };
  }

  /**
   * Получение состояния агентов
   */
  getAgentStatus(): Array<{
    id: string;
    role: AgentRole;
    status: AgentStatus;
    currentTask?: string;
  }> {
    return Array.from(this.agents.values()).map(agent => ({
      id: agent.id,
      role: agent.role,
      status: agent.status,
      currentTask: agent.currentTask?.id,
    }));
  }

  /**
   * Остановка агента
   */
  stopAgent(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.status = AgentStatus.OFFLINE;
      this.logger.info(`Agent stopped: ${agent.role} (${agentId})`);
    }
  }

  /**
   * Перезапуск агента
   */
  restartAgent(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.status = AgentStatus.IDLE;
      agent.lastActive = Date.now();
      this.logger.info(`Agent restarted: ${agent.role} (${agentId})`);
    }
  }
}
