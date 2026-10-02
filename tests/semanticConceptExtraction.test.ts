import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { PipelineOrchestrator } from '../src/services/pipelineOrchestrator';
import { buildDocumentProfile } from '../src/services/documentUnderstanding';
import { chunkText } from '../src/services/textExtraction';
import type { KnowledgeSource, TextChunk } from '../src/types/knowledgeGraph';

describe('Semantic AI Concept Extraction - Educational Physics Chapter', () => {
  const opticsChapterText = `
# Chapter 10: Light - Reflection and Refraction

Light seems to travel along straight lines. The fact that a small source of light casts a sharp shadow of an opaque object points to this straight-line path of light.

## 10.1 Reflection of Light
A highly polished surface, such as a mirror, reflects most of the light falling on it.
The laws of reflection state that the angle of incidence is equal to the angle of reflection.
The incident ray, the normal to the mirror at the point of incidence, and the reflected ray, all lie in the same plane.

## 10.2 Spherical Mirrors
The reflecting surface of a spherical mirror may be curved inwards or outwards.
A spherical mirror whose reflecting surface is curved inwards, that is, faces towards the centre of the sphere, is called a concave mirror.
A spherical mirror whose reflecting surface is curved outwards is called a convex mirror.

The centre of the reflecting surface of a spherical mirror is a point called the pole (P).
The reflecting surface of a spherical mirror forms a part of a sphere. The centre of this sphere is called the centre of curvature (C).
The radius of the sphere of which the reflecting surface of a spherical mirror forms a part is called the radius of curvature (R).
Imagine a straight line passing through the pole and the centre of curvature of a spherical mirror. This line is called the principal axis.
The distance from the pole to the principal focus of a spherical mirror is called the focal length (f).

## 10.2.1 Image Formation by Spherical Mirrors
Ray diagrams provide an effective method to study image formation by spherical mirrors.
An object placed at infinity in front of a concave mirror forms a real and inverted image at the principal focus.
This property is important for solar concentrators.
For example, the process of finding the image location uses rays parallel to the principal axis.
Users often use concave mirrors as shaving mirrors and in vehicle headlights.
Another important example shows that a convex mirror gives a wider field of view.

## 10.2.2 Mirror Formula and Magnification
In a spherical mirror, the distance of the object from its pole is called the object distance (u).
The distance of the image from the pole of the mirror is called the image distance (v).
The relationship between image distance, object distance, and focal length is known as the Mirror Formula.
Mirror formula: 1/v + 1/u = 1/f

Magnification produced by a spherical mirror gives the relative extent to which the image of an object is magnified with respect to the object size.
Magnification is expressed as the ratio of the height of the image to the height of the object.
Magnification: m = h'/h = -v/u

## General Summary
This system and method of calculating optics data provides valuable information for optical design.
Each example illustrates the property of reflection.
`;

  test('buildDocumentProfile correctly understands document structure, sections, definitions, and formulas', () => {
    const chunks = chunkText('src-optics', opticsChapterText, { maxChunkWords: 200, overlapWords: 30 });
    const profile = buildDocumentProfile(chunks, {
      id: 'src-optics',
      name: 'Chapter 10: Light - Reflection and Refraction',
      fileName: 'optics_chapter.txt',
      fileType: 'text/plain',
      size: opticsChapterText.length,
      uploadedAt: Date.now(),
      status: 'ready'
    });

    assert.ok(profile.title.includes('Light') || profile.title.includes('optics'), 'Title should reflect the chapter');
    assert.equal(profile.inferredDomain, 'Physics');
    assert.ok(profile.inferredSubject.includes('Optics'), 'Subject should infer Optics & Light');
    assert.ok(profile.sections.length >= 4, 'Should extract all major sections');

    // Verify definitions were extracted
    const defTerms = profile.definitionsFound.map(d => d.term.toLowerCase());
    assert.ok(defTerms.some(t => t.includes('concave mirror')), 'Should extract Concave Mirror definition');
    assert.ok(defTerms.some(t => t.includes('convex mirror')), 'Should extract Convex Mirror definition');
    assert.ok(defTerms.some(t => t.includes('focal length')), 'Should extract Focal Length definition');
    assert.ok(defTerms.some(t => t.includes('principal axis')), 'Should extract Principal Axis definition');

    // Verify formulas were extracted
    assert.ok(profile.formulasFound.length >= 1, 'Should extract formulas');
    assert.ok(profile.formulasFound.some(f => f.formula.includes('1/v') || f.formula.includes('1/f')), 'Should identify mirror formula');
  });

  test('end-to-end extraction rejects generic words and extracts clean educational concept map', async () => {
    const source: KnowledgeSource = {
      id: 'source-optics',
      name: 'Chapter 10: Light - Reflection and Refraction',
      fileName: 'optics_chapter.txt',
      fileType: 'text/plain',
      size: opticsChapterText.length,
      uploadedAt: Date.now(),
      status: 'ready',
      text: opticsChapterText
    };

    const orchestrator = new PipelineOrchestrator();
    const result = await orchestrator.execute([source]);

    assert.equal(result.success, true, `Pipeline execution failed: ${result.error?.message}`);
    assert.ok(result.graph, 'Knowledge graph must be created');
    assert.ok(result.relevanceReport, 'Relevance report must exist');

    const graph = result.graph!;
    const nodeNames = graph.nodes.map(n => n.name.toLowerCase());

    // 1. REJECT WEAK / GENERIC CANDIDATES
    const genericWords = [
      'object', 'important', 'method', 'system', 'example',
      'property', 'use', 'process', 'information', 'data'
    ];
    for (const generic of genericWords) {
      assert.ok(
        !nodeNames.includes(generic),
        `Generic word "${generic}" should NOT become an accepted graph node!`
      );
    }

    // 2. PRESERVE ACTUAL EDUCATIONAL CONCEPTS
    assert.ok(nodeNames.some(n => n.includes('spherical mirror')), 'Spherical Mirrors should be present');
    assert.ok(nodeNames.some(n => n.includes('concave mirror')), 'Concave Mirror should be present');
    assert.ok(nodeNames.some(n => n.includes('convex mirror')), 'Convex Mirror should be present');
    assert.ok(nodeNames.some(n => n.includes('mirror formula')), 'Mirror Formula should be present');
    assert.ok(nodeNames.some(n => n.includes('magnification')), 'Magnification should be present');
    assert.ok(nodeNames.some(n => n.includes('focal length')), 'Focal Length should be present');
    assert.ok(nodeNames.some(n => n.includes('principal axis')), 'Principal Axis should be present');

    // 3. MULTI-WORD TECHNICAL CONCEPTS REMAIN COMPLETE
    const concaveNode = graph.nodes.find(n => n.name.toLowerCase().includes('concave mirror'));
    assert.ok(concaveNode, 'Concave Mirror must remain a complete multi-word concept');
    assert.equal(concaveNode.name.toLowerCase().includes('concave mirror'), true);

    const mirrorFormulaNode = graph.nodes.find(n => n.name.toLowerCase().includes('mirror formula'));
    assert.ok(mirrorFormulaNode, 'Mirror Formula must remain a complete multi-word concept');

    // 4. SOURCE EVIDENCE & TRACEABILITY
    for (const node of graph.nodes) {
      assert.ok(node.sourceIds.length > 0, `Node "${node.name}" must have sourceIds`);
      assert.ok(node.sourceChunkIds && node.sourceChunkIds.length > 0, `Node "${node.name}" must have sourceChunkIds`);
    }

    // 5. CONCEPT TYPES ARE SENSIBLE
    if (mirrorFormulaNode) {
      assert.equal(mirrorFormulaNode.type, 'Formula', 'Mirror Formula should have Formula type');
    }

    // 6. CONNECTIVITY
    assert.ok(graph.relationships.length > 0, 'Should extract relationships between concepts');

    // 7. RELEVANCE REPORT TRACKS REJECTIONS
    assert.ok(result.relevanceReport.rejectedCount > 0, 'Should track rejected candidate terms');
  });
});
