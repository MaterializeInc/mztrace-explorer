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
    error: "foobar",
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

  // console.log(traceTree.children.at(0));
  // return unique root node
  return traceTree.children.at(0);
}

export function indexTraceTree(traceTree) {
  let traceIndex = postOrder(traceTree);
  traceIndex.sort((a, b) => a.id < b.id);
  return traceIndex;
}

function postOrder(traceTree) {
  if (traceTree.children) {
    const list = traceTree.children.flatMap(child => postOrder(child));
    return list.concat([traceTree]);
  } else {
    return [traceTree];
  }
}

function WizardNav(props) {
  return (
    <Container fluid>
      <Row className="wizard-nav justify-content-md-center">
        <Col md="auto">
          <Button variant={props.currentStep === 1 ? 'primary' : 'secondary'} onClick={() => props.goToStep(1)}>select</Button>{' '}
          <Button variant={props.currentStep === 2 ? 'primary' : 'secondary'} onClick={() => props.goToStep(2)}>explore</Button>
        </Col>
      </Row>
    </Container>
  );
}
