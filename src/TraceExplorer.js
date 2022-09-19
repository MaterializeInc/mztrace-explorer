import React, { createContext, useContext, useState } from 'react';
import { Alert, Row, Col, Container } from 'react-bootstrap';

import { TraceContext } from './App';

const TraceExplorerContext = createContext();

export default function TraceExplorer() {
  const [trace] = useContext(TraceContext);
  const [state, setState] = useState({ focus: [] });

  if (trace.error) {
    return (
      <Container>
        <Row>
          <Col>
            <Alert variant="danger">
              <Alert.Heading>Oh snap! You got an error!</Alert.Heading>
              <p>{trace.error}</p>
            </Alert>
          </Col>
        </Row>
      </Container>
    );
  } else if (trace.tree && trace.index) { // assuming well-defined trace below
    return (
      <TraceExplorerContext.Provider value={[state, setState]}>
        <Container fluid>
          <Row>
            <Col xs={3}>
              <TraceNavChildren children={[trace.tree]} />
            </Col>
            <Col>
              <TraceView />
            </Col>
          </Row>
        </Container>
      </TraceExplorerContext.Provider>
    );
  }
}

function TraceNavChildren({ children }) {
  let items = children.map((node) => {
    return <TraceNavNode node={node} key={node.id} />
  }).reverse();

  return (
    <ul>
      {items}
    </ul>
  );
}

function TraceNavNode({ node }) {
  const [state, setState] = useContext(TraceExplorerContext);

  const handleClick = (event) => {
    setState({
      ...state,
      focus: [...state.focus, event.target.id].slice(-2)
    });
  }

  const segment = node.path.split('/').pop();

  if (node.children) {
    return <li>
      <a href={'#' + node.path} id={node.id} onClick={handleClick}>{segment}</a>
      <TraceNavChildren children={node.children} />
    </li>;
  } else {
    return <li>
      <a href={'#' + node.path} id={node.id} onClick={handleClick}>{segment}</a>
    </li>;
  }
}

// TODO: use diff-based view here. Options are:
// 1) http://incaseofstairs.com/jsdiff/
// 2) 
function TraceView() {
  const [trace] = useContext(TraceContext);
  const [explorer_state] = useContext(TraceExplorerContext);

  if (explorer_state.focus.length === 2) {
    let lhs = trace.index[explorer_state.focus[0]];
    let rhs = trace.index[explorer_state.focus[1]];
    return (
      <Row>
        <Col>
          <h6>{lhs.path.split("/").map(segment => <span>{segment}</span>).reduce((prev, curr) => [prev, ' / ', curr])}</h6>
          <pre><code>{lhs.plan}</code></pre>
        </Col>
        <Col>
          <h6>{rhs.path.split("/").map(segment => <span>{segment}</span>).reduce((prev, curr) => [prev, ' / ', curr])}</h6>
          <pre><code>{rhs.plan}</code></pre>
        </Col>
      </Row>
    );
  } else if (explorer_state.focus.length === 1) {
    let entry = trace.index[explorer_state.focus[0]];
    return (
      <>
        <h6>{entry.path.split("/").map(segment => <span>{segment}</span>).reduce((prev, curr) => [prev, ' / ', curr])}</h6>
        <pre><code>{entry.plan}</code></pre>
      </>
    );
  } else {
    return (
      <></>
    );
  }
}