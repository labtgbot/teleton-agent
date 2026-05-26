/**
 * Advanced Workflow Designer Page
 * 
 * Drag-and-drop visual workflow builder with:
 * - Visual node editor
 * - Condition branching (if/else)
 * - Loops and parallel execution
 * - Template library
 */

import { useEffect, useState, useCallback } from "react";
import { api } from "../lib/api";

// ── Types ─────────────────────────────────────────────────────────────

interface WorkflowNode {
  id: string;
  type: "trigger" | "action" | "condition" | "loop" | "parallel";
  position: { x: number; y: number };
  data: {
    label: string;
    config?: any;
    inputs?: string[];
    outputs?: string[];
  };
}

interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  condition?: string;
}

interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  variables: Record<string, any>;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

// ── Node Types Configuration ─────────────────────────────────────────

const NODE_TYPES = {
  trigger: {
    label: "Trigger",
    icon: "⚡",
    color: "#3b82f6",
    inputs: [],
    outputs: ["next"],
  },
  action: {
    label: "Action",
    icon: "🔧",
    color: "#10b981",
    inputs: ["prev"],
    outputs: ["next"],
  },
  condition: {
    label: "Condition",
    icon: "❓",
    color: "#f59e0b",
    inputs: ["prev"],
    outputs: ["true", "false"],
  },
  loop: {
    label: "Loop",
    icon: "🔄",
    color: "#8b5cf6",
    inputs: ["prev"],
    outputs: ["next", "iterate"],
  },
  parallel: {
    label: "Parallel",
    icon: "∥",
    color: "#06b6d4",
    inputs: ["prev"],
    outputs: ["branch1", "branch2", "merge"],
  },
};

const TEMPLATES: Template[] = [
  {
    id: "telegram_notification",
    name: "Telegram Notification",
    description: "Send a message when an event occurs",
    category: "Communication",
    nodes: [
      {
        id: "trigger_1",
        type: "trigger",
        position: { x: 100, y: 100 },
        data: { label: "Event Trigger", config: { eventType: "agent.start" } },
      },
      {
        id: "action_1",
        type: "action",
        position: { x: 300, y: 100 },
        data: { label: "Send Message", config: { actionType: "send_message" } },
      },
    ],
    edges: [{ id: "edge_1", source: "trigger_1", target: "action_1" }],
  },
  {
    id: "conditional_response",
    name: "Conditional Response",
    description: "Respond differently based on message content",
    category: "Logic",
    nodes: [
      {
        id: "trigger_1",
        type: "trigger",
        position: { x: 100, y: 100 },
        data: { label: "Message Received", config: { eventType: "message.receive" } },
      },
      {
        id: "condition_1",
        type: "condition",
        position: { x: 300, y: 100 },
        data: { label: "Is Important?", config: { condition: "contains('urgent')" } },
      },
      {
        id: "action_1",
        type: "action",
        position: { x: 500, y: 50 },
        data: { label: "High Priority Response", config: {} },
      },
      {
        id: "action_2",
        type: "action",
        position: { x: 500, y: 150 },
        data: { label: "Normal Response", config: {} },
      },
    ],
    edges: [
      { id: "edge_1", source: "trigger_1", target: "condition_1" },
      { id: "edge_2", source: "condition_1", target: "action_1", label: "Yes" },
      { id: "edge_3", source: "condition_1", target: "action_2", label: "No" },
    ],
  },
  {
    id: "daily_report",
    name: "Daily Report",
    description: "Generate and send daily summary",
    category: "Scheduled",
    nodes: [
      {
        id: "trigger_1",
        type: "trigger",
        position: { x: 100, y: 100 },
        data: { label: "Daily at 9AM", config: { cron: "0 9 * * *" } },
      },
      {
        id: "action_1",
        type: "action",
        position: { x: 300, y: 100 },
        data: { label: "Collect Data", config: {} },
      },
      {
        id: "action_2",
        type: "action",
        position: { x: 500, y: 100 },
        data: { label: "Generate Report", config: {} },
      },
      {
        id: "action_3",
        type: "action",
        position: { x: 700, y: 100 },
        data: { label: "Send Report", config: {} },
      },
    ],
    edges: [
      { id: "edge_1", source: "trigger_1", target: "action_1" },
      { id: "edge_2", source: "action_1", target: "action_2" },
      { id: "edge_3", source: "action_2", target: "action_3" },
    ],
  },
];

// ── Node Component ────────────────────────────────────────────────────

function WorkflowNodeComponent({
  node,
  isSelected,
  onSelect,
  onDelete,
  onDragStart,
}: {
  node: WorkflowNode;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDragStart: (e: React.DragEvent) => void;
}) {
  const nodeConfig = NODE_TYPES[node.type as keyof typeof NODE_TYPES];

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onSelect}
      style={{
        position: "absolute",
        left: node.position.x,
        top: node.position.y,
        width: "200px",
        padding: "12px",
        borderRadius: "8px",
        background: "var(--card-bg)",
        border: `2px solid ${isSelected ? "#3b82f6" : nodeConfig.color}`,
        cursor: "move",
        boxShadow: isSelected ? "0 4px 12px rgba(59, 130, 246, 0.3)" : "0 2px 8px rgba(0,0,0,0.1)",
        zIndex: isSelected ? 10 : 1,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
        <span style={{ fontSize: "20px" }}>{nodeConfig.icon}</span>
        <span style={{ fontWeight: 600, fontSize: "14px" }}>{node.data.label}</span>
      </div>
      
      <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginBottom: "8px" }}>
        {nodeConfig.label}
      </div>
      
      {node.data.config && Object.keys(node.data.config).length > 0 && (
        <div style={{ fontSize: "10px", background: "var(--bg-tertiary)", padding: "4px", borderRadius: "4px" }}>
          {JSON.stringify(node.data.config, null, 2).slice(0, 80)}...
        </div>
      )}
      
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        style={{
          position: "absolute",
          top: "4px",
          right: "4px",
          background: "#ef4444",
          color: "white",
          border: "none",
          borderRadius: "50%",
          width: "20px",
          height: "20px",
          fontSize: "12px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        ×
      </button>
      
      {/* Input ports */}
      {nodeConfig.inputs.map((input, idx) => (
        <div
          key={input}
          style={{
            position: "absolute",
            left: "-6px",
            top: `${40 + idx * 20}px`,
            width: "12px",
            height: "12px",
            borderRadius: "50%",
            background: "#6b7280",
            border: "2px solid white",
          }}
        />
      ))}
      
      {/* Output ports */}
      {nodeConfig.outputs.map((output, idx) => (
        <div
          key={output}
          style={{
            position: "absolute",
            right: "-6px",
            top: `${40 + idx * 20}px`,
            width: "12px",
            height: "12px",
            borderRadius: "50%",
            background: nodeConfig.color,
            border: "2px solid white",
          }}
        />
      ))}
    </div>
  );
}

// ── Properties Panel ──────────────────────────────────────────────────

function PropertiesPanel({
  node,
  onChange,
}: {
  node: WorkflowNode | null;
  onChange: (node: WorkflowNode) => void;
}) {
  if (!node) {
    return (
      <div style={{ padding: "20px", color: "var(--text-secondary)", fontStyle: "italic" }}>
        Select a node to edit its properties
      </div>
    );
  }

  return (
    <div style={{ padding: "20px" }}>
      <h3 style={{ margin: "0 0 16px", fontSize: "16px" }}>Node Properties</h3>
      
      <div style={{ marginBottom: "16px" }}>
        <label style={{ display: "block", marginBottom: "4px", fontSize: "12px", color: "var(--text-secondary)" }}>
          Label
        </label>
        <input
          type="text"
          value={node.data.label}
          onChange={(e) => onChange({ ...node, data: { ...node.data, label: e.target.value } })}
          style={{ width: "100%" }}
        />
      </div>
      
      <div style={{ marginBottom: "16px" }}>
        <label style={{ display: "block", marginBottom: "4px", fontSize: "12px", color: "var(--text-secondary)" }}>
          Type
        </label>
        <select
          value={node.type}
          disabled
          style={{ width: "100%", opacity: 0.6 }}
        >
          {Object.entries(NODE_TYPES).map(([key, config]) => (
            <option key={key} value={key}>
              {config.icon} {config.label}
            </option>
          ))}
        </select>
      </div>
      
      <div>
        <label style={{ display: "block", marginBottom: "4px", fontSize: "12px", color: "var(--text-secondary)" }}>
          Configuration (JSON)
        </label>
        <textarea
          value={JSON.stringify(node.data.config || {}, null, 2)}
          onChange={(e) => {
            try {
              const config = JSON.parse(e.target.value);
              onChange({ ...node, data: { ...node.data, config } });
            } catch {
              // Invalid JSON, ignore
            }
          }}
          style={{ width: "100%", minHeight: "200px", fontFamily: "monospace", fontSize: "12px" }}
        />
      </div>
    </div>
  );
}

// ── Templates Sidebar ─────────────────────────────────────────────────

function TemplatesSidebar({ onImport }: { onImport: (template: Template) => void }) {
  const [selectedCategory, setSelectedCategory] = useState("All");
  
  const categories = ["All", ...Array.from(new Set(TEMPLATES.map((t) => t.category)))];
  const filteredTemplates = selectedCategory === "All" 
    ? TEMPLATES 
    : TEMPLATES.filter((t) => t.category === selectedCategory);

  return (
    <div style={{ width: "250px", borderRight: "1px solid var(--border-color)", padding: "16px" }}>
      <h3 style={{ margin: "0 0 16px", fontSize: "16px" }}>📚 Templates</h3>
      
      <div style={{ marginBottom: "16px" }}>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          style={{ width: "100%" }}
        >
          {categories.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>
      
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {filteredTemplates.map((template) => (
          <div
            key={template.id}
            style={{
              padding: "12px",
              borderRadius: "8px",
              background: "var(--bg-tertiary)",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
            onClick={() => onImport(template)}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <div style={{ fontWeight: 600, fontSize: "14px", marginBottom: "4px" }}>
              {template.name}
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginBottom: "8px" }}>
              {template.description}
            </div>
            <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>
              {template.nodes.length} nodes • {template.edges.length} connections
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Workflow Designer Component ──────────────────────────────────

export function WorkflowDesigner() {
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
  const [currentWorkflow, setCurrentWorkflow] = useState<WorkflowDefinition | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTemplates, setShowTemplates] = useState(true);

  const loadWorkflows = useCallback(async () => {
    try {
      const response = await api.get("/api/workflows");
      setWorkflows(response.data.workflows || []);
      if (response.data.workflows?.length > 0) {
        setCurrentWorkflow(response.data.workflows[0]);
      }
      setLoading(false);
    } catch (error) {
      console.error("Failed to load workflows:", error);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWorkflows();
  }, [loadWorkflows]);

  const handleCreateWorkflow = () => {
    const newWorkflow: WorkflowDefinition = {
      id: `workflow_${Date.now()}`,
      name: "New Workflow",
      description: "",
      nodes: [],
      edges: [],
      variables: {},
      enabled: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setWorkflows([...workflows, newWorkflow]);
    setCurrentWorkflow(newWorkflow);
  };

  const handleImportTemplate = (template: Template) => {
    if (!currentWorkflow) return;
    
    const updatedWorkflow: WorkflowDefinition = {
      ...currentWorkflow,
      name: template.name,
      description: template.description,
      nodes: template.nodes.map((n) => ({ ...n, id: `${n.id}_${Date.now()}` })),
      edges: template.edges.map((e) => ({ ...e, id: `${e.id}_${Date.now()}` })),
      updatedAt: Date.now(),
    };
    
    setCurrentWorkflow(updatedWorkflow);
    setWorkflows(workflows.map((w) => (w.id === currentWorkflow.id ? updatedWorkflow : w)));
  };

  const handleDeleteNode = (nodeId: string) => {
    if (!currentWorkflow) return;
    
    const updatedWorkflow = {
      ...currentWorkflow,
      nodes: currentWorkflow.nodes.filter((n) => n.id !== nodeId),
      edges: currentWorkflow.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
      updatedAt: Date.now(),
    };
    
    setCurrentWorkflow(updatedWorkflow);
    setWorkflows(workflows.map((w) => (w.id === currentWorkflow.id ? updatedWorkflow : w)));
    if (selectedNode === nodeId) setSelectedNode(null);
  };

  const handleUpdateNode = (updatedNode: WorkflowNode) => {
    if (!currentWorkflow) return;
    
    const updatedWorkflow = {
      ...currentWorkflow,
      nodes: currentWorkflow.nodes.map((n) => (n.id === updatedNode.id ? updatedNode : n)),
      updatedAt: Date.now(),
    };
    
    setCurrentWorkflow(updatedWorkflow);
    setWorkflows(workflows.map((w) => (w.id === currentWorkflow.id ? updatedWorkflow : w)));
  };

  if (loading) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "var(--text-secondary)" }}>
        <div className="spinner" style={{ margin: "0 auto 16px" }} />
        Loading workflows...
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "calc(100vh - 140px)" }}>
      {/* Left Sidebar - Workflows List */}
      <div style={{ width: "200px", borderRight: "1px solid var(--border-color)", padding: "16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h3 style={{ margin: 0, fontSize: "16px" }}>Workflows</h3>
          <button onClick={handleCreateWorkflow} className="btn-primary" style={{ padding: "4px 8px", fontSize: "12px" }}>
            + New
          </button>
        </div>
        
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {workflows.map((wf) => (
            <div
              key={wf.id}
              onClick={() => setCurrentWorkflow(wf)}
              style={{
                padding: "10px",
                borderRadius: "6px",
                background: currentWorkflow?.id === wf.id ? "var(--primary)" : "var(--bg-tertiary)",
                color: currentWorkflow?.id === wf.id ? "white" : "var(--text-primary)",
                cursor: "pointer",
                fontSize: "13px",
                transition: "all 0.2s",
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: "2px" }}>{wf.name}</div>
              <div style={{ fontSize: "10px", opacity: 0.7 }}>
                {wf.nodes.length} nodes • {wf.enabled ? "✓ Enabled" : "✗ Disabled"}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Templates Sidebar */}
      {showTemplates && <TemplatesSidebar onImport={handleImportTemplate} />}

      {/* Main Canvas */}
      <div style={{ flex: 1, position: "relative", background: "var(--bg-secondary)", overflow: "auto" }}>
        {currentWorkflow ? (
          <>
            <div
              style={{
                position: "absolute",
                top: "16px",
                left: "16px",
                right: "16px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                zIndex: 100,
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: "20px" }}>{currentWorkflow.name}</h2>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                  {currentWorkflow.description || "No description"}
                </div>
              </div>
              
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={() => setShowTemplates(!showTemplates)}
                  className="btn-ghost"
                  style={{ padding: "6px 12px", fontSize: "13px" }}
                >
                  {showTemplates ? "Hide" : "Show"} Templates
                </button>
                <button className="btn-primary" style={{ padding: "6px 16px", fontSize: "13px" }}>
                  Save
                </button>
                <button className="btn-success" style={{ padding: "6px 16px", fontSize: "13px" }}>
                  Run
                </button>
              </div>
            </div>
            
            {/* Canvas */}
            <div style={{ position: "relative", width: "2000px", height: "2000px", padding: "100px" }}>
              {/* Grid background */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  backgroundImage: `
                    linear-gradient(var(--border-color) 1px, transparent 1px),
                    linear-gradient(90deg, var(--border-color) 1px, transparent 1px)
                  `,
                  backgroundSize: "20px 20px",
                  opacity: 0.3,
                }}
              />
              
              {/* Nodes */}
              {currentWorkflow.nodes.map((node) => (
                <WorkflowNodeComponent
                  key={node.id}
                  node={node}
                  isSelected={selectedNode === node.id}
                  onSelect={() => setSelectedNode(node.id)}
                  onDelete={() => handleDeleteNode(node.id)}
                  onDragStart={() => {}}
                />
              ))}
              
              {/* Edges (SVG lines) */}
              <svg style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                {currentWorkflow.edges.map((edge) => {
                  const sourceNode = currentWorkflow.nodes.find((n) => n.id === edge.source);
                  const targetNode = currentWorkflow.nodes.find((n) => n.id === edge.target);
                  
                  if (!sourceNode || !targetNode) return null;
                  
                  return (
                    <g key={edge.id}>
                      <line
                        x1={sourceNode.position.x + 200}
                        y1={sourceNode.position.y + 50}
                        x2={targetNode.position.x}
                        y2={targetNode.position.y + 50}
                        stroke="var(--border-color)"
                        strokeWidth="2"
                        markerEnd="url(#arrowhead)"
                      />
                      {edge.label && (
                        <text
                          x={(sourceNode.position.x + 200 + targetNode.position.x) / 2}
                          y={(sourceNode.position.y + 50 + targetNode.position.y + 50) / 2 - 5}
                          fill="var(--text-secondary)"
                          fontSize="10"
                          textAnchor="middle"
                        >
                          {edge.label}
                        </text>
                      )}
                    </g>
                  );
                })}
                
                <defs>
                  <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="var(--border-color)" />
                  </marker>
                </defs>
              </svg>
            </div>
          </>
        ) : (
          <div style={{ padding: "40px", textAlign: "center", color: "var(--text-secondary)" }}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>📝</div>
            <div style={{ fontSize: "18px", fontWeight: 600, marginBottom: "8px" }}>No workflow selected</div>
            <div style={{ marginBottom: "16px" }}>Create a new workflow or select an existing one</div>
            <button onClick={handleCreateWorkflow} className="btn-primary">
              Create Workflow
            </button>
          </div>
        )}
      </div>

      {/* Right Sidebar - Properties */}
      <div style={{ width: "300px", borderLeft: "1px solid var(--border-color)", background: "var(--card-bg)" }}>
        <PropertiesPanel
          node={currentWorkflow?.nodes.find((n) => n.id === selectedNode) || null}
          onChange={handleUpdateNode}
        />
      </div>
    </div>
  );
}

export default WorkflowDesigner;
