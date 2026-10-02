import React from 'react';
import { KnowledgeOrb3D } from './KnowledgeOrb3D';

/**
 * KnowledgeParticleField
 * 
 * Re-exports KnowledgeOrb3D to maintain backward-compatibility with any legacy imports.
 */
export const KnowledgeParticleField: React.FC = () => {
  return <KnowledgeOrb3D />;
};

export { KnowledgeOrb3D };
