import React, { createContext, useState } from 'react';
import { Button, Col, Container, Row } from 'react-bootstrap';
import StepWizard from "react-step-wizard";

import './App.css';
import TraceExplorer from './TraceExplorer';
import TraceSelector from './TraceSelector';

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

export function toTraceList(results) {
  return results.rows.map(([time, path, plan], id) => ({
    id, time, path, plan
  }));
}

/* Complete a broken trace entry list emitted by a EXPLAIN statement.
 *
 * In particular, we insert special entries designating a missing plan for each
 * segment that is not closed.
 */
export function completeTraceList(traceList) {
  var openSegments = [];
  var fixedList = [];
  var nextId = 0;

  for (const entry of traceList) {
    const currSegments = entry.path.replace(/~*$/, "").split('/');

    // Find the highest index designating a common prefix between
    // curr_segments and open_segments.
    var commonPrefix = 0;
    for (let i = 0; i < Math.min(openSegments.length, currSegments.length); i++) {
        if (currSegments[i] === openSegments[i]) {
          commonPrefix++;
        } else {
          break;
        }
    }

    switch (openSegments.length - commonPrefix) {
      case 0:
        // Happy case: entry.path is a repeated path or a subpath of the last
        // seen path.
        break;
      case 1:
        // Happy case: entry.path is a parent path or a child of the parent path
        // of the last seen path. Remove the last seen segment.
        openSegments.pop();
        break;
      default:
        // Bad case: entry.path is a non-direct ancestor on a child of a
        // non-direct ancestor of the last seen path. We need to insert "MISSING
        // PLAN" entries for all intermediate paths on the ancestor chain.
        console.log(`- missing segments before ${entry.path}: ${openSegments.slice(commonPrefix, -1)}`);
        for (let i = openSegments.length - 1; i > commonPrefix; i--) {
          const path = openSegments.slice(0, i).join("/");
          const time = fixedList
            .slice(fixedList.findLastIndex((e) => !e.path.startsWith(`${path}/`)) + 1)
            .reduce((t, e) => {
              if (e.path.includes('/', `${path}/`.length)) {
                return t;
              } else {
                return t + parseInt(e.time);
              }
            }, 0);

          fixedList.push({
            id: nextId++,
            time: time,
            path: path,
            plan: "(missing plan)"
          });
        }

        // Remove the last seen segment and the segments corresponding to the
        // missing plan entries added above.
        openSegments = openSegments.slice(0, commonPrefix);
    }

    // Add segments opened by the current entry.
    for (let i = commonPrefix; i < currSegments.length; i++) {
      openSegments.push(currSegments[i]);
    }

    // Add the current entry (with adjusted id value) to the fixed list.
    fixedList.push({...entry, id: nextId++ });
  }

  if (openSegments.length > 1) {
    // Bad case: the last seen entry.path was not the root path. We need to insert "MISSING
    // PLAN" entries for all intermediate paths on the ancestor chain.
    console.log(`- missing segments at the end: ${openSegments}`);
    for (let i = openSegments.length - 1; i > 0; i--) {
      const path = openSegments.slice(0, i).join("/");
      const time = fixedList
        .slice(fixedList.findLastIndex((e) => !e.path.startsWith(`${path}/`)) + 1)
        .reduce((t, e) => {
          if (e.path.includes('/', `${path}/`.length)) {
            return t;
          } else {
            return t + parseInt(e.time);
          }
        }, 0);

      fixedList.push({
        id: nextId++,
        time: time,
        path: path,
        plan: "(missing plan)"
      });
    }
  }

  return fixedList;
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

/** Mark nodes with a plan identical to their non-descendant predecessor with 'noop: true'. */
export function computeNoopFlag(traceIndex) {
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
