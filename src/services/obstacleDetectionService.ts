// ============================================
// Obstacle Detection Service — AI Abstraction Layer
// The frontend does not know which model/service is used.
// Supports future swap to YOLO, segmentation, or external inference.
// ============================================

import type { Obstacle, ObstacleType, ConfidenceLevel } from '@/types/rooftop.js';
import { v4 as uuidv4 } from 'uuid';

export interface DetectionCandidate {
  type: ObstacleType;
  geometry: GeoJSON.Polygon | GeoJSON.Point;
  geometryKind: 'point' | 'rectangle' | 'polygon';
  confidence: number; // 0-100
  area: number | null;
  suggestedClearance: number;
  suggestedHeight: number | null;
}

export interface DetectionResult {
  success: boolean;
  candidates: DetectionCandidate[];
  error: string | null;
  modelVersion: string | null;
  detectionTimeMs: number;
}

function confidenceToLevel(confidence: number): ConfidenceLevel {
  if (confidence >= 80) return 'high';
  if (confidence >= 50) return 'medium';
  return 'low';
}

/**
 * Main detection entry point.
 * Currently returns a "service unavailable" result to gracefully
 * fall back to manual obstacle creation.
 *
 * When a real AI model is connected, replace the implementation
 * inside this function without changing the interface.
 */
export async function detectObstacles(
  _roofGeometry: GeoJSON.Polygon,
  _imageUrl?: string,
): Promise<DetectionResult> {
  // Simulate network delay for realistic UX
  await new Promise((resolve) => setTimeout(resolve, 1500));

  // --- AI SERVICE NOT YET CONNECTED ---
  // Return graceful "unavailable" so UI falls back to manual mode.
  return {
    success: false,
    candidates: [],
    error: 'Automatic obstacle detection is not yet available. You can continue by marking rooftop obstacles manually.',
    modelVersion: null,
    detectionTimeMs: 1500,
  };
}

/**
 * Converts an AI detection candidate into a full Obstacle object
 * with status = "pending" awaiting user review.
 */
export function candidateToObstacle(
  candidate: DetectionCandidate,
  rooftopId: string,
): Obstacle {
  const now = new Date().toISOString();
  return {
    id: `obs-${uuidv4().substring(0, 8)}`,
    rooftopId,
    type: candidate.type,
    geometryKind: candidate.geometryKind,
    geometry: candidate.geometry,
    area: candidate.area,
    height: candidate.suggestedHeight,
    clearance: candidate.suggestedClearance,
    confidence: candidate.confidence,
    confidenceLevel: confidenceToLevel(candidate.confidence),
    source: 'ai',
    status: 'pending',
    label: null,
    createdAt: now,
    updatedAt: now,
  };
}
