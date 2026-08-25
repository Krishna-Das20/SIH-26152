'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from '@/components/Navbar';
import { OverviewMetrics } from '@/components/OverviewMetrics';
import { PageAnalyzerInput } from '@/components/PageAnalyzerInput';
import { TimelineScrubber } from '@/components/TimelineScrubber';
import { NetworkGraphView } from '@/components/NetworkGraphView';
import { SentimentEmotionView } from '@/components/SentimentEmotionView';
import { DemographicRadarView } from '@/components/DemographicRadarView';
import { TrendTopicDetector } from '@/components/TrendTopicDetector';
import { LiveFeedStream } from '@/components/LiveFeedStream';
import { NodeDetailsDrawer } from '@/components/NodeDetailsDrawer';
import { GraphNode, SocialPost, NetworkTopology, PlatformType } from '@/types/intelligence';

export default function Dashboard() {
  const [activePlatform, setActivePlatform] = useState('all');
  const [isLoading, setIsLoading] = useState(false);

  // Timeline State
  const [startTime, setStartTime] = useState('2026-08-25T00:00:00.000Z');
  const [endTime, setEndTime] = useState('2026-08-25T23:59:59.000Z');
  const [currentTime, setCurrentTime] = useState('2026-08-25T23:59:59.000Z');
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  // Data States
  const [metrics, setMetrics] = useState({
    totalPosts: 0,
    activeNodes: 0,
    averageSentiment: 0,
    sarcasmIndex: 0,
    threatLevel: 'LOW',
    supportivePercentage: 0,
    opposingPercentage: 0
  });

  const [topology, setTopology] = useState<NetworkTopology>({
    nodes: [],
    links: [],
    communities: [],
    topKOLs: []
  });

  const [sentimentData, setSentimentData] = useState({
    emotionRadar: [],
    sarcasmRate: 0,
    stanceDistribution: [],
    temporalTimeline: []
  });

  const [demographicData, setDemographicData] = useState({
    ageGroups: [],
    geographicDistribution: [],
    languages: [],
    interestClusters: []
  });

  const [trends, setTrends] = useState([]);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  // Fetch Analytics across all endpoints
  const fetchAnalytics = useCallback(async (timeCutoff?: string, platformFilter?: string) => {
    try {
      const p = platformFilter || activePlatform;
      const t = timeCutoff || currentTime;
      const query = `?cutoffTime=${encodeURIComponent(t)}&platform=${p}`;

      const [overviewRes, graphRes, sentimentRes, demoRes, trendsRes] = await Promise.all([
        fetch(`/api/analytics/overview${query}`).then(r => r.json()),
        fetch(`/api/analytics/graph${query}`).then(r => r.json()),
        fetch(`/api/analytics/sentiment${query}`).then(r => r.json()),
        fetch(`/api/analytics/demographics${query}`).then(r => r.json()),
        fetch(`/api/analytics/trends${query}`).then(r => r.json())
      ]);

      if (overviewRes && !overviewRes.error) {
        setMetrics(overviewRes);
      }
      if (graphRes?.topology) {
        setTopology(graphRes.topology);
      }
      if (sentimentRes && !sentimentRes.error) {
        setSentimentData(sentimentRes);
      }
      if (demoRes && !demoRes.error) {
        setDemographicData(demoRes);
      }
      if (trendsRes?.trends) {
        setTrends(trendsRes.trends);
      }
    } catch (e) {
      console.error('Failed to load intelligence analytics:', e);
    }
  }, [activePlatform, currentTime]);

  // Initial Load
  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Playback Simulation Interval
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setCurrentTime(prev => {
        const currentMs = new Date(prev).getTime();
        const startMs = new Date(startTime).getTime();
        const endMs = new Date(endTime).getTime();

        const stepMs = 15 * 60 * 1000 * playbackSpeed;
        let nextMs = currentMs + stepMs;

        if (nextMs >= endMs) {
          setIsPlaying(false);
          return endTime;
        }

        const nextIso = new Date(nextMs).toISOString();
        fetchAnalytics(nextIso, activePlatform);
        return nextIso;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed, startTime, endTime, activePlatform, fetchAnalytics]);

  // Trigger Live Ingestion
  const handleTriggerIngestion = async (subreddit: string = 'india') => {
    setIsLoading(true);
    try {
      await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subreddit })
      });
      await fetchAnalytics();
    } catch (e) {
      console.error('Ingestion failed:', e);
    } finally {
      setIsLoading(false);
    }
  };

  // Reset Dataset
  const handleResetDataset = async () => {
    setIsLoading(true);
    try {
      await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' })
      });
      setCurrentTime(endTime);
      await fetchAnalytics();
    } catch (e) {
      console.error('Reset failed:', e);
    } finally {
      setIsLoading(false);
    }
  };

  // Manual Ingest Inject
  const handleManualPostSubmit = async (text: string, platform: PlatformType) => {
    setIsLoading(true);
    try {
      await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'custom', customText: text, platform })
      });
      await fetchAnalytics();
    } catch (e) {
      console.error('Post injection failed:', e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07090e] pb-16">
      
      {/* 1. Header & Auth State */}
      <Navbar
        activePlatform={activePlatform}
        onPlatformChange={(p) => {
          setActivePlatform(p);
          fetchAnalytics(currentTime, p);
        }}
        onTriggerIngestion={handleTriggerIngestion}
        onResetDataset={handleResetDataset}
        isLoading={isLoading}
        threatLevel={metrics.threatLevel}
      />

      <main className="max-w-7xl mx-auto px-4 pt-6">
        
        {/* 2. Top-Level KPIs */}
        <OverviewMetrics metrics={metrics} />

        {/* 3. Real Target Page / Channel OSINT Scraper (Zero Dummy Data) */}
        <PageAnalyzerInput onAnalyzeSuccess={() => fetchAnalytics()} />

        {/* 4. Component A & D: Chronological Timeline Scrubber */}
        <TimelineScrubber
          startTime={startTime}
          endTime={endTime}
          currentTime={currentTime}
          onTimeChange={(t) => {
            setCurrentTime(t);
            fetchAnalytics(t, activePlatform);
          }}
          isPlaying={isPlaying}
          onTogglePlay={() => setIsPlaying(!isPlaying)}
          playbackSpeed={playbackSpeed}
          onSpeedChange={(s) => setPlaybackSpeed(s)}
        />

        {/* 5. Component E: Link Analysis & Force-Directed Network Graph */}
        <NetworkGraphView
          topology={topology}
          onSelectNode={(node) => setSelectedNode(node)}
          selectedNode={selectedNode}
        />

        {/* 6. Component B: Multi-Dimensional Sentiment, Emotion Radar & Sarcasm Timeline */}
        <SentimentEmotionView data={sentimentData} />

        {/* 7. Component C: Automated Demographic Profiling (Age, Geo, Language, Interests) */}
        <DemographicRadarView data={demographicData} />

        {/* 8. Component D: Real-Time Trend & Viral Topic Detection */}
        <TrendTopicDetector
          trends={trends}
          onSelectTopic={(topic) => {
            // Filter by topic
          }}
        />

        {/* 9. Component A: Multi-Platform Ingestion Feed & Custom Injection */}
        <LiveFeedStream
          posts={topology.nodes.map((n, idx) => ({
            id: `post_${n.id}_${idx}`,
            platform: n.platform,
            author: {
              id: n.id,
              username: n.username,
              displayName: n.label,
              platform: n.platform,
              followerCount: n.followerCount,
              verified: n.isKOL,
              estimatedAgeBracket: n.ageBracket as any,
              inferredLocation: n.inferredLocation,
              detectedLanguage: 'English',
              interests: ['Tech & AI']
            },
            content: `Live OSINT node profile for @${n.username} in community #${n.communityId}. Reach: ${n.followerCount.toLocaleString()} users.`,
            timestamp: currentTime,
            likes: Math.floor(n.followerCount * 0.05),
            shares: Math.floor(n.followerCount * 0.01),
            replies: Math.floor(n.followerCount * 0.005),
            hashtags: ['#LiveIntel', '#SIH2026'],
            sentiment: {
              score: n.dominantSentiment === 'positive' ? 0.75 : n.dominantSentiment === 'negative' ? -0.65 : 0.1,
              label: n.dominantSentiment,
              nuancedEmotion: n.dominantEmotion,
              sarcasmScore: n.dominantSentiment === 'negative' ? 0.65 : 0.08,
              stance: n.dominantSentiment === 'positive' ? 'supportive' : 'opposing',
              confidence: 0.92,
              keywords: ['live', 'intel']
            }
          }))}
          onManualPostSubmit={handleManualPostSubmit}
          isLoading={isLoading}
        />

      </main>

      {/* 10. Component E: Node Dossier Inspection Drawer */}
      <NodeDetailsDrawer
        node={selectedNode}
        onClose={() => setSelectedNode(null)}
      />

    </div>
  );
}
