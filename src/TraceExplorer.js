import React, { createContext, useContext, useState } from 'react';
import { Row, Col } from 'react-bootstrap';

import { TraceContext } from './App';

const TraceExplorerContext = createContext();

function TraceExplorer() {
  const [trace] = useContext(TraceContext);
  const [state, setState] = useState({ focus: [] });

  return (
    <TraceExplorerContext.Provider value={[state, setState]}>
      <Row>
        <Col xs={2}>
          <TraceNav entry={trace.tree} />
        </Col>
        <Col>
          <TraceView />
        </Col>
      </Row>
    </TraceExplorerContext.Provider>
  );
}

function TraceNav({ entry }) {
  return (
    <>
      <h3>trace</h3>
      <TraceNavChildren children={[entry]} />
    </>
  )
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

  const segment = node.path.split('.').pop();

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

function TraceView() {
  const [trace] = useContext(TraceContext);
  const [state] = useContext(TraceExplorerContext);

  if (state.focus.length === 2) {
    let lhs = trace.index[state.focus[0]];
    let rhs = trace.index[state.focus[1]];
    return (
      <Row>
        <Col>
          <h3>{lhs.path}</h3>
          <pre><code>{lhs.plan}</code></pre>
        </Col>
        <Col>
          <h3>{rhs.path}</h3>
          <pre><code>{rhs.plan}</code></pre>
        </Col>
      </Row>
    );
  } else if (state.focus.length === 1) {
    let entry = trace.index[state.focus[0]];
    return (
      <>
        <h3>{entry.path}</h3>
        <pre><code>{entry.plan}</code></pre>
      </>
    );
  } else {
    return (
      <></>
    );
  }
}

export default TraceExplorer;