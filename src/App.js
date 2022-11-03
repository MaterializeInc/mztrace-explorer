import React, { createContext, useState } from 'react';
import { Button, Container, Row, Col } from 'react-bootstrap';
import StepWizard from "react-step-wizard";
import TraceExplorer from './TraceExplorer';
import TraceSelector from './TraceSelector';

import './App.css';

export const TraceContext = createContext({
  error: "No trace selected at the moment."
});

export default function App(props) {
  const [trace, setTrace] = useState({
    error: "No trace has been selected yet.",
    tree: {},
    index: []
  });

  return (
    <TraceContext.Provider value={[trace, setTrace]}>
      <StepWizard nav={<WizardNav />}>
        <TraceSelector stepName={"select"} />
        <TraceExplorer stepName={"explore"} />
      </StepWizard>
    </TraceContext.Provider>
  );
}

/** Convert the given list of traces to a tree-shaped structure. */
export function toTraceTree(traceList) {
  // initialize root tree
  let traceTree = {
    children: []
  }

  // convert traceList entries to traceTree nodes
  for (const entry of traceList) {
    // find the node associated with the current path in the tree,
    // creating the path lazily if it does not exist
    let [node, path] = [traceTree, ""];
    entry.path.split('/').forEach(segment => {
      // compute partial path
      path = path.length > 0 ? `${path}/${segment}` : segment;

      // ensure that the tree entry associated with that path exists
      // append a child if 
      // 1) the plan is not empty (as setting a plan "seals" the subtree)
      // 2) if the path differs
      if (node.children.at(-1)?.plan || node.children.at(-1)?.path !== path) {
        node.children.push({
          path: path,
          time: 0,
          plan: "",
          children: []
        });
      }
      // navigate to the tree entry associated with that path
      node = node.children.at(-1);
    });

    node.id = entry.id;
    node.time = entry.time;
    node.plan = entry.plan;
  }

  // assert that a unique root node exists
  console.assert(traceTree.children.length === 1, "Root node is not unique.");

  // return unique root node
  return traceTree.children[0];
}

/** Create an index to the nodes in the given `traceTree` in ascending post-visit order. */
export function indexTraceTree(traceTree) {
  let traceIndex = postOrder(traceTree);
  traceIndex.sort((a, b) => a.id < b.id);
  return traceIndex;
}

/** Mark nodes with a plan identical to their predecessor with 'noop: true'. */
export function computeActiveFlag(traceIndex) {
  for (var curr = 0; curr < traceIndex.length; curr++) {
    // find index of last non-descendant predecessor
    const desc = new Set(descendants(traceIndex[curr]));
    const pred = traceIndex.slice(0, curr).findLastIndex(node => !desc.has(node));

    // if findLastIndex fails, pred will be -1 and traceIndex[pred]?.plan will be undefined
    traceIndex[curr].noop = traceIndex[curr].plan === traceIndex[pred]?.plan;
  }
}

function postOrder(traceTree) {
  if (traceTree.children) {
    const list = traceTree.children.flatMap(child => postOrder(child));
    return list.concat([traceTree]);
  } else {
    return [traceTree];
  }
}

function descendants(node) {
  return node.children.flatMap(child => descendants(child)).concat(node.children);
}

function WizardNav(props) {
  return (
    <Container fluid>
      <Row className="wizard-nav justify-content-md-center">
        <Col md="auto">
          <Button variant={props.currentStep === 1 ? 'primary' : 'secondary'} onClick={() => props.goToStep(1)}>1. Select trace</Button>{' '}
          <Button variant={props.currentStep === 2 ? 'primary' : 'secondary'} onClick={() => props.goToStep(2)}>2. Explore trace</Button>
        </Col>
      </Row>
    </Container>
  );
}
