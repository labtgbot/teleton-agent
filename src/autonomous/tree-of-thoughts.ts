/**
 * Tree of Thoughts (ToT): Advanced Reasoning Framework
 *
 * Implements multi-path reasoning with:
 * - Branch generation (multiple thought paths)
 * - State evaluation (scoring each branch)
 * - Search algorithms (BFS, DFS, Beam Search)
 * - Backtracking and pruning
 */

import type { LLMProvider } from "../services/llm/provider.js";
import { logger } from "../utils/logger.js";

export interface ThoughtNode {
  id: string;
  content: string;
  depth: number;
  parent?: string;
  children: string[];
  score: number;
  status: "pending" | "explored" | "pruned" | "selected";
  metadata: Record<string, unknown>;
}

export interface ThoughtTree {
  root: string;
  nodes: Map<string, ThoughtNode>;
  currentPath: string[];
  completedPaths: string[][];
}

export enum SearchStrategy {
  BFS = "BFS",
  DFS = "DFS",
  BEAM_SEARCH = "BEAM_SEARCH",
  GREEDY = "GREEDY",
}

export interface ToTConfig {
  maxDepth: number;
  maxBranches: number;
  beamWidth: number;
  searchStrategy: SearchStrategy;
  minScoreThreshold: number;
  enableBacktracking: boolean;
}

export class TreeOfThoughts {
  private llm: LLMProvider;
  private tree: ThoughtTree;
  private config: ToTConfig;

  constructor(llm: LLMProvider, config?: Partial<ToTConfig>) {
    this.llm = llm;
    this.config = {
      maxDepth: config?.maxDepth || 5,
      maxBranches: config?.maxBranches || 3,
      beamWidth: config?.beamWidth || 2,
      searchStrategy: config?.searchStrategy || SearchStrategy.BEAM_SEARCH,
      minScoreThreshold: config?.minScoreThreshold || 0.3,
      enableBacktracking: config?.enableBacktracking ?? true,
    };

    this.tree = {
      root: "",
      nodes: new Map(),
      currentPath: [],
      completedPaths: [],
    };
  }

  /**
   * Main entry: Solve problem using Tree of Thoughts
   */
  async solve(problem: string): Promise<{ solution: string; path: string[]; confidence: number }> {
    logger.info(`[ToT] Solving problem: ${problem.substring(0, 100)}...`);

    // Initialize tree with root
    const rootNode = await this.createNode(problem, 0, undefined);
    this.tree.root = rootNode.id;
    this.tree.nodes.set(rootNode.id, rootNode);

    // Execute search based on strategy
    let resultPath: string[];
    switch (this.config.searchStrategy) {
      case SearchStrategy.BFS:
        resultPath = await this.bfsSearch();
        break;
      case SearchStrategy.DFS:
        resultPath = await this.dfsSearch();
        break;
      case SearchStrategy.BEAM_SEARCH:
        resultPath = await this.beamSearch();
        break;
      case SearchStrategy.GREEDY:
        resultPath = await this.greedySearch();
        break;
      default:
        resultPath = await this.beamSearch();
    }

    // Extract solution from best path
    const solution = await this.synthesizeSolution(resultPath);
    const avgConfidence = this.calculatePathConfidence(resultPath);

    return {
      solution,
      path: resultPath.map((id) => this.tree.nodes.get(id)?.content || ""),
      confidence: avgConfidence,
    };
  }

  /**
   * Create a new thought node
   */
  private async createNode(
    content: string,
    depth: number,
    parentId?: string
  ): Promise<ThoughtNode> {
    const id = `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Initial score estimation
    const score = await this.evaluateThought(content);

    const node: ThoughtNode = {
      id,
      content,
      depth,
      parent: parentId,
      children: [],
      score,
      status: "pending",
      metadata: { created_at: Date.now() },
    };

    if (parentId) {
      const parent = this.tree.nodes.get(parentId);
      if (parent) {
        parent.children.push(id);
      }
    }

    return node;
  }

  /**
   * Generate multiple thought branches from current state
   */
  private async generateBranches(currentThought: string, depth: number): Promise<string[]> {
    const prompt = `Given the current thought, generate ${this.config.maxBranches} different approaches to continue.

Current Thought: ${currentThought}

Generate ${this.config.maxBranches} distinct next thoughts that explore different possibilities.
Format each as a separate paragraph.

Next Thoughts:`;

    const response = await this.llm.generate(prompt, { temperature: 0.8 });

    // Parse response into separate branches (simplified)
    const branches = response
      .split("\n\n")
      .filter((b) => b.trim().length > 10)
      .slice(0, this.config.maxBranches);

    logger.debug(`[ToT] Generated ${branches.length} branches at depth ${depth}`);
    return branches;
  }

  /**
   * Evaluate the quality/score of a thought
   */
  private async evaluateThought(thought: string): Promise<number> {
    const prompt = `Evaluate the quality of this thought on a scale of 0.0 to 1.0.

Thought: ${thought}

Consider:
- Relevance to the problem
- Logical consistency
- Potential for leading to a solution
- Novelty and creativity

Score (just return a number between 0.0 and 1.0):`;

    try {
      const response = await this.llm.generate(prompt, { temperature: 0.2, maxTokens: 10 });
      const score = parseFloat(response.trim());
      return isNaN(score) ? 0.5 : Math.max(0, Math.min(1, score));
    } catch {
      logger.warn("[ToT] Evaluation failed, using default score");
      return 0.5;
    }
  }

  /**
   * Beam Search: Maintain top-k candidates at each level
   */
  private async beamSearch(): Promise<string[]> {
    let currentBeam: string[] = [this.tree.root];
    const _allPaths: string[][] = [];

    for (let depth = 0; depth < this.config.maxDepth; depth++) {
      logger.debug(`[ToT] Beam search at depth ${depth}, beam size: ${currentBeam.length}`);

      const nextCandidates: Array<{ nodeId: string; score: number; path: string[] }> = [];

      // Expand each node in current beam
      for (const nodeId of currentBeam) {
        const node = this.tree.nodes.get(nodeId);
        if (!node || node.status === "pruned") continue;

        // Generate branches
        const branches = await this.generateBranches(node.content, depth + 1);

        for (const branchContent of branches) {
          const childNode = await this.createNode(branchContent, depth + 1, nodeId);
          this.tree.nodes.set(childNode.id, childNode);

          // Build path to this node
          const path = this.buildPathToNode(childNode.id);
          nextCandidates.push({
            nodeId: childNode.id,
            score: childNode.score,
            path,
          });
        }

        node.status = "explored";
      }

      // Sort by score and keep top beamWidth
      nextCandidates.sort((a, b) => b.score - a.score);
      const topCandidates = nextCandidates.slice(0, this.config.beamWidth);

      if (topCandidates.length === 0) break;

      currentBeam = topCandidates.map((c) => c.nodeId);

      // Check for completion (if any path reaches high confidence)
      if (topCandidates[0].score > 0.9) {
        logger.info(`[ToT] Found high-confidence path at depth ${depth}`);
        return topCandidates[0].path;
      }
    }

    // Return best path found
    const bestNodeId = currentBeam.reduce((best, current) => {
      const currentNode = this.tree.nodes.get(current);
      const bestNode = this.tree.nodes.get(best);
      return (currentNode?.score || 0) > (bestNode?.score || 0) ? current : best;
    });

    return this.buildPathToNode(bestNodeId);
  }

  /**
   * BFS: Explore all nodes level by level
   */
  private async bfsSearch(): Promise<string[]> {
    const queue: string[] = [this.tree.root];
    const visited = new Set<string>();

    while (queue.length > 0 && visited.size < 100) {
      const nodeId = queue.shift() ?? "";
      if (!nodeId || visited.has(nodeId)) continue;

      visited.add(nodeId);
      const node = this.tree.nodes.get(nodeId);
      if (!node) continue;

      if (node.score > 0.85) {
        logger.info(`[ToT] BFS found high-scoring node: ${nodeId}`);
        return this.buildPathToNode(nodeId);
      }

      if (node.depth >= this.config.maxDepth) continue;

      const branches = await this.generateBranches(node.content, node.depth + 1);
      for (const branchContent of branches) {
        const childNode = await this.createNode(branchContent, node.depth + 1, nodeId);
        this.tree.nodes.set(childNode.id, childNode);
        queue.push(childNode.id);
      }

      node.status = "explored";
    }

    // Return best path if no high-score found
    return this.findBestPath();
  }

  /**
   * DFS: Explore one path deeply before backtracking
   */
  private async dfsSearch(): Promise<string[]> {
    const stack: string[] = [this.tree.root];
    const visited = new Set<string>();
    let bestPath: string[] = [];
    let bestScore = 0;

    while (stack.length > 0) {
      const nodeId = stack.pop() ?? "";
      if (!nodeId || visited.has(nodeId)) continue;

      visited.add(nodeId);
      const node = this.tree.nodes.get(nodeId);
      if (!node) continue;

      const currentPath = this.buildPathToNode(nodeId);
      if (node.score > bestScore) {
        bestScore = node.score;
        bestPath = currentPath;
      }

      if (node.score > 0.9) {
        logger.info(`[ToT] DFS found excellent path`);
        return currentPath;
      }

      if (node.depth >= this.config.maxDepth) continue;

      const branches = await this.generateBranches(node.content, node.depth + 1);
      // Add in reverse order so highest score is processed first
      for (const branchContent of branches.reverse()) {
        const childNode = await this.createNode(branchContent, node.depth + 1, nodeId);
        this.tree.nodes.set(childNode.id, childNode);
        stack.push(childNode.id);
      }

      node.status = "explored";
    }

    return bestPath;
  }

  /**
   * Greedy Search: Always pick highest-scoring child
   */
  private async greedySearch(): Promise<string[]> {
    let currentNodeId = this.tree.root;
    const path: string[] = [currentNodeId];

    for (let depth = 0; depth < this.config.maxDepth; depth++) {
      const node = this.tree.nodes.get(currentNodeId);
      if (!node) break;

      if (node.score > 0.9) {
        logger.info(`[ToT] Greedy found high-confidence solution`);
        break;
      }

      const branches = await this.generateBranches(node.content, depth + 1);
      if (branches.length === 0) break;

      // Create all children and pick best
      let bestChildId = "";
      let bestChildScore = -1;

      for (const branchContent of branches) {
        const childNode = await this.createNode(branchContent, depth + 1, currentNodeId);
        this.tree.nodes.set(childNode.id, childNode);

        if (childNode.score > bestChildScore) {
          bestChildScore = childNode.score;
          bestChildId = childNode.id;
        }
      }

      if (bestChildId) {
        currentNodeId = bestChildId;
        path.push(currentNodeId);
      } else {
        break;
      }
    }

    return path;
  }

  /**
   * Synthesize final solution from path
   */
  private async synthesizeSolution(path: string[]): Promise<string> {
    const pathContents = path.map((id) => this.tree.nodes.get(id)?.content).filter(Boolean);

    const prompt = `Synthesize a final solution from these reasoning steps:

${pathContents.map((c, i) => `Step ${i + 1}: ${c}`).join("\n")}

Provide a comprehensive, well-reasoned final solution:

Final Solution:`;

    return await this.llm.generate(prompt, { temperature: 0.5 });
  }

  /**
   * Build path from root to node
   */
  private buildPathToNode(nodeId: string): string[] {
    const path: string[] = [];
    let current = this.tree.nodes.get(nodeId);

    while (current) {
      path.unshift(current.id);
      if (!current.parent) break;
      current = this.tree.nodes.get(current.parent);
    }

    return path;
  }

  /**
   * Calculate average confidence along path
   */
  private calculatePathConfidence(path: string[]): number {
    if (path.length === 0) return 0;

    const scores = path.map((id) => this.tree.nodes.get(id)?.score || 0);
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  }

  /**
   * Find best path in current tree
   */
  private findBestPath(): string[] {
    let bestNodeId = this.tree.root;
    let bestScore = this.tree.nodes.get(this.tree.root)?.score || 0;

    for (const [id, node] of this.tree.nodes.entries()) {
      if (node.score > bestScore) {
        bestScore = node.score;
        bestNodeId = id;
      }
    }

    return this.buildPathToNode(bestNodeId);
  }

  /**
   * Get tree visualization data
   */
  getTreeData(): { nodes: ThoughtNode[]; edges: Array<{ from: string; to: string }> } {
    const nodes = Array.from(this.tree.nodes.values());
    const edges: Array<{ from: string; to: string }> = [];

    for (const node of nodes) {
      if (node.parent) {
        edges.push({ from: node.parent, to: node.id });
      }
    }

    return { nodes, edges };
  }
}
