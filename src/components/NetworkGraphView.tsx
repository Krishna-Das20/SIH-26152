'use client';

import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3-force';
import { NetworkTopology, GraphNode, GraphLink } from '@/types/intelligence';
import { Share2, ZoomIn, ZoomOut, RotateCcw, Sparkles } from 'lucide-react';

interface NetworkGraphViewProps {
  topology: NetworkTopology;
  onSelectNode: (node: GraphNode) => void;
  selectedNode: GraphNode | null;
}

export const NetworkGraphView: React.FC<NetworkGraphViewProps> = ({
  topology,
  onSelectNode,
  selectedNode
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [colorMode, setColorMode] = useState<'community' | 'sentiment'>('community');
  const [filterKOLOnly, setFilterKOLOnly] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const isDraggingCanvas = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const draggedNodeRef = useRef<any | null>(null);

  const communityColors = ['#00f0ff', '#10b981', '#f59e0b', '#f43f5e', '#a855f7', '#3b82f6'];

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = container.clientWidth || 800;
    const height = 520;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    // Deep clone nodes and links to allow d3-force to mutate coordinates
    let filteredNodes: GraphNode[] = topology.nodes.map(n => ({ ...n }));
    if (filterKOLOnly) {
      filteredNodes = filteredNodes.filter(n => n.isKOL);
    }
    const nodeIds = new Set(filteredNodes.map(n => n.id));

    const filteredLinks: any[] = topology.links
      .filter(l => {
        const s = typeof l.source === 'string' ? l.source : l.source.id;
        const t = typeof l.target === 'string' ? l.target : l.target.id;
        return nodeIds.has(s) && nodeIds.has(t);
      })
      .map(l => ({ ...l }));

    // Set up D3 Force Simulation with wide spacing and strong repulsion
    const simulation = d3.forceSimulation(filteredNodes as any)
      .force('link', d3.forceLink(filteredLinks).id((d: any) => d.id).distance(140))
      .force('charge', d3.forceManyBody().strength(-450))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius((d: any) => Math.max(22, (d.centralityScore / 4) + 16)))
      .alpha(1)
      .alphaDecay(0.028);

    let animationFrameId: number;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      ctx.save();
      ctx.translate(transform.x, transform.y);
      ctx.scale(transform.k, transform.k);

      // 1. Draw Links
      filteredLinks.forEach(link => {
        ctx.beginPath();
        ctx.moveTo(link.source.x, link.source.y);
        ctx.lineTo(link.target.x, link.target.y);
        
        if (link.type === 'retweet') {
          ctx.strokeStyle = 'rgba(0, 240, 255, 0.35)';
          ctx.lineWidth = 1.5;
        } else if (link.type === 'reply') {
          ctx.strokeStyle = 'rgba(168, 85, 247, 0.35)';
          ctx.lineWidth = 1.2;
        } else {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
          ctx.lineWidth = 1;
        }
        ctx.stroke();
      });

      // 2. Draw Nodes Body & Halos
      filteredNodes.forEach(node => {
        const radius = Math.max(7, Math.min(22, (node.centralityScore / 6) + 6));
        const isSelected = selectedNode?.id === node.id;
        const isHovered = hoveredNode?.id === node.id;

        // Determine node color
        let color = '#00f0ff';
        if (colorMode === 'community') {
          color = communityColors[node.communityId % communityColors.length];
        } else {
          color = node.dominantSentiment === 'positive' ? '#10b981' : node.dominantSentiment === 'negative' ? '#f43f5e' : '#94a3b8';
        }

        // Outer Glow Ring for KOLs or Selected
        if (node.isKOL || isSelected || isHovered) {
          ctx.beginPath();
          ctx.arc(node.x!, node.y!, radius + 5, 0, 2 * Math.PI);
          ctx.fillStyle = isSelected
            ? 'rgba(0, 240, 255, 0.45)'
            : node.isBotSuspicious
            ? 'rgba(244, 63, 94, 0.35)'
            : `${color}35`;
          ctx.fill();
        }

        // Inner Circle
        ctx.beginPath();
        ctx.arc(node.x!, node.y!, radius, 0, 2 * Math.PI);
        ctx.fillStyle = node.isBotSuspicious ? '#f43f5e' : color;
        ctx.fill();
        ctx.strokeStyle = isSelected ? '#ffffff' : 'rgba(15, 23, 42, 0.8)';
        ctx.lineWidth = isSelected ? 2.5 : 1.5;
        ctx.stroke();
      });

      // 3. Draw Clean Non-Overlapping Labels (Hovered or Selected or Top Central KOLs)
      filteredNodes.forEach(node => {
        const isSelected = selectedNode?.id === node.id;
        const isHovered = hoveredNode?.id === node.id;
        const isTopKOL = node.isKOL && node.centralityScore > 75;

        if (isHovered || isSelected || isTopKOL) {
          const label = `@${node.username}`;
          ctx.font = 'bold 11px monospace';
          const textMetrics = ctx.measureText(label);
          const textWidth = textMetrics.width;
          const radius = Math.max(7, Math.min(22, (node.centralityScore / 6) + 6));
          const textY = node.y! + radius + 15;

          // Draw pill background
          ctx.fillStyle = isSelected ? 'rgba(0, 240, 255, 0.95)' : 'rgba(15, 23, 42, 0.88)';
          ctx.beginPath();
          ctx.roundRect(node.x! - textWidth / 2 - 5, textY - 11, textWidth + 10, 16, 4);
          ctx.fill();
          ctx.strokeStyle = isSelected ? '#000000' : 'rgba(255, 255, 255, 0.2)';
          ctx.lineWidth = 0.8;
          ctx.stroke();

          // Draw text
          ctx.fillStyle = isSelected ? '#000000' : '#ffffff';
          ctx.textAlign = 'center';
          ctx.fillText(label, node.x!, textY);
        }
      });

      ctx.restore();
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    // Mouse Interaction for Hover, Node Dragging, and Canvas Pan
    const getCanvasCoords = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left - transform.x) / transform.k;
      const my = (e.clientY - rect.top - transform.y) / transform.k;
      return { mx, my };
    };

    const handleMouseDown = (e: MouseEvent) => {
      const { mx, my } = getCanvasCoords(e);

      // Check if clicking a node
      for (const n of filteredNodes) {
        const radius = Math.max(7, Math.min(22, (n.centralityScore / 6) + 6));
        const dist = Math.hypot(n.x! - mx, n.y! - my);
        if (dist <= radius + 5) {
          draggedNodeRef.current = n;
          n.fx = n.x;
          n.fy = n.y;
          simulation.alphaTarget(0.3).restart();
          return;
        }
      }

      // Otherwise, start dragging canvas pan
      isDraggingCanvas.current = true;
      dragStart.current = { x: e.clientX - transform.x, y: e.clientY - transform.y };
    };

    const handleMouseMove = (e: MouseEvent) => {
      const { mx, my } = getCanvasCoords(e);

      if (draggedNodeRef.current) {
        draggedNodeRef.current.fx = mx;
        draggedNodeRef.current.fy = my;
        return;
      }

      if (isDraggingCanvas.current) {
        setTransform(prev => ({
          ...prev,
          x: e.clientX - dragStart.current.x,
          y: e.clientY - dragStart.current.y
        }));
        return;
      }

      // Hover check
      let found: GraphNode | null = null;
      for (const n of filteredNodes) {
        const radius = Math.max(7, Math.min(22, (n.centralityScore / 6) + 6));
        const dist = Math.hypot(n.x! - mx, n.y! - my);
        if (dist <= radius + 5) {
          found = n;
          break;
        }
      }
      setHoveredNode(found);
      canvas.style.cursor = found ? 'pointer' : isDraggingCanvas.current ? 'grabbing' : 'default';
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (draggedNodeRef.current) {
        draggedNodeRef.current.fx = null;
        draggedNodeRef.current.fy = null;
        draggedNodeRef.current = null;
        simulation.alphaTarget(0);
      }
      isDraggingCanvas.current = false;
    };

    const handleClick = (e: MouseEvent) => {
      const { mx, my } = getCanvasCoords(e);

      for (const n of filteredNodes) {
        const radius = Math.max(7, Math.min(22, (n.centralityScore / 6) + 6));
        const dist = Math.hypot(n.x! - mx, n.y! - my);
        if (dist <= radius + 5) {
          onSelectNode(n);
          return;
        }
      }
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      setTransform(prev => ({
        ...prev,
        k: Math.max(0.4, Math.min(3.0, prev.k * zoomFactor))
      }));
    };

    canvas.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('click', handleClick);
    canvas.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      simulation.stop();
      cancelAnimationFrame(animationFrameId);
      canvas.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('click', handleClick);
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, [topology, colorMode, filterKOLOnly, selectedNode, transform]);

  return (
    <div className="intel-card rounded-xl p-4 border border-intel-border mb-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
        
        {/* Title & Stats */}
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Share2 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
              Link Analysis & Network Topology
              <span className="text-xs font-mono text-slate-400 font-normal">
                ({topology.nodes.length} Nodes • {topology.links.length} Edges)
              </span>
            </h3>
          </div>
        </div>

        {/* Graph Controls */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* Color Mode Selector */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs font-mono">
            <button
              onClick={() => setColorMode('community')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                colorMode === 'community' ? 'bg-intel-cyan text-black font-bold' : 'text-slate-400'
              }`}
            >
              Communities
            </button>
            <button
              onClick={() => setColorMode('sentiment')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                colorMode === 'sentiment' ? 'bg-intel-cyan text-black font-bold' : 'text-slate-400'
              }`}
            >
              Sentiments
            </button>
          </div>

          {/* KOL Only Filter */}
          <button
            onClick={() => setFilterKOLOnly(!filterKOLOnly)}
            className={`px-2.5 py-1 rounded-lg text-xs font-mono border transition-all flex items-center gap-1 ${
              filterKOLOnly
                ? 'bg-amber-950 border-amber-600 text-amber-400 font-semibold'
                : 'bg-slate-900 border-slate-800 text-slate-400'
            }`}
          >
            <Sparkles className="w-3 h-3" />
            KOLs Only
          </button>

          {/* Zoom controls */}
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1">
            <button
              onClick={() => setTransform(t => ({ ...t, k: Math.min(3.0, t.k + 0.2) }))}
              className="p-1 text-slate-400 hover:text-white"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setTransform(t => ({ ...t, k: Math.max(0.4, t.k - 0.2) }))}
              className="p-1 text-slate-400 hover:text-white"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setTransform({ x: 0, y: 0, k: 1 })}
              className="p-1 text-slate-400 hover:text-white"
              title="Reset View"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>

      </div>

      {/* Interactive Network Canvas */}
      <div ref={containerRef} className="relative w-full h-[520px] bg-slate-950/80 rounded-lg overflow-hidden border border-slate-900">
        <canvas ref={canvasRef} className="w-full h-full block" />

        {/* Hover Tooltip Overlay */}
        {hoveredNode && (
          <div className="absolute top-3 left-3 bg-slate-900/95 backdrop-blur-md border border-intel-cyan/40 p-2.5 rounded-lg text-xs font-mono shadow-xl z-20 pointer-events-none max-w-xs">
            <div className="font-bold text-white text-sm flex items-center gap-1.5">
              <span>@{hoveredNode.username}</span>
              {hoveredNode.isKOL && (
                <span className="text-[10px] bg-amber-950 text-amber-400 border border-amber-800 px-1 rounded">KOL</span>
              )}
              {hoveredNode.isBotSuspicious && (
                <span className="text-[10px] bg-rose-950 text-rose-400 border border-rose-800 px-1 rounded">BOT SUSPECT</span>
              )}
            </div>
            <div className="text-slate-400 text-[11px] mt-0.5">{hoveredNode.label}</div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2 text-[10px] border-t border-slate-800 pt-1.5">
              <div>Reach: <span className="text-cyan-400">{hoveredNode.followerCount.toLocaleString()}</span></div>
              <div>Influence: <span className="text-purple-400">{hoveredNode.centralityScore}/100</span></div>
              <div>Location: <span className="text-white">{hoveredNode.inferredLocation}</span></div>
              <div>Sentiment: <span className={hoveredNode.dominantSentiment === 'positive' ? 'text-emerald-400' : 'text-rose-400'}>{hoveredNode.dominantSentiment}</span></div>
            </div>
          </div>
        )}

        {/* Community Legend Bar */}
        <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 bg-slate-900/90 backdrop-blur-sm border border-slate-800 px-3 py-1.5 rounded-lg text-[11px] font-mono">
          <div className="flex items-center gap-3">
            <span className="text-slate-400 font-bold uppercase">Communities:</span>
            {topology.communities.map((comm) => (
              <div key={comm.id} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: comm.color }} />
                <span className="text-slate-300">{comm.name}</span>
              </div>
            ))}
          </div>
          <div className="text-slate-400 text-[10px]">
            *Drag nodes to reposition • Scroll to zoom • Click node for dossier
          </div>
        </div>
      </div>
    </div>
  );
};
