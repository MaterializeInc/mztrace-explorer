import React, { createContext, useContext, useEffect, useState } from 'react';
import { Alert, Button, Col, Container, Row } from 'react-bootstrap';
import { CopyToClipboard } from 'react-copy-to-clipboard';

import { TraceContext } from './App';

import './TraceExplorer.css';

const TraceExplorerContext = createContext();

export default function TraceExplorer() {
  const [trace] = useContext(TraceContext);
  const [state, setState] = useState({
    path: trace.index[0]?.path,
    plan: trace.index[0]?.plan
  });

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
              <TraceNav key="nav" root={trace.tree} />
            </Col>
            <Col xs={9}>
              <TraceView key="view" />
            </Col>
          </Row>
        </Container>
      </TraceExplorerContext.Provider>
    );
  }
}

const TraceNavContext = createContext();

function TraceNav({ root }) {
  const [trace] = useContext(TraceContext);
  const [explorerState, setExplorerState] = useContext(TraceExplorerContext);
  const [state, setState] = useState({ active: 0, closed: [] });
  // key-based navigation state
  const nextKeyPress = useKeyPress("n");
  const prevKeyPress = useKeyPress("p");
  const copyKeyPress = useKeyPress("c");

  // key-based navigation handlers
  useEffect(() => {
    if (nextKeyPress && state.active !== undefined) {
      const currPlan = trace.index.at(state.active).plan;
      const slice = trace.index.slice(state.active, trace.index.length);
      const offset = slice.findIndex(entry => currPlan !== entry.plan);
      const id = (offset >= 0) ? state.active + offset : 0;
      // console.log(`active=${id}, offset=${offset}`);
      setState(state => ({
        ...state,
        active: id
      }));
      setExplorerState(explorerState => ({
        ...explorerState,
        path: trace.index[id].path,
        plan: trace.index[id].plan
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextKeyPress, trace]);
  useEffect(() => {
    if (prevKeyPress && state.active !== undefined) {
      const prevPlan = trace.index.at(state.active - 1).plan;
      const slice = trace.index.slice(0, state.active);
      const offset = slice.findIndex(entry => prevPlan === entry.plan);
      const id = (offset >= 0) ? offset : trace.index.length - 1;
      // console.log(`active=${id}, offset=${offset}`);
      setState(state => ({
        ...state,
        active: id
      }));
      setExplorerState(explorerState => ({
        ...explorerState,
        path: trace.index[id].path,
        plan: trace.index[id].plan
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prevKeyPress, trace]);
  useEffect(() => {
    if (window.isSecureContext && copyKeyPress && state.active !== undefined) {
      const node = trace.index.at(state.active);
      navigator.clipboard.writeText(node.path + '\n' + node.plan);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [copyKeyPress, trace]);

  const hideAll = (event) => {
    setState({
      ...state,
      // don't collapse the root node
      closed: Array.from(trace.index.slice(0, -1).keys())
    });
    event.preventDefault();
  }

  const showAll = (event) => {
    setState({
      ...state,
      closed: []
    });
    event.preventDefault();
  }

  const showSQL = (event) => {
    setExplorerState({
      ...explorerState,
      path: "SQL query",
      plan: trace.explainee.query ? trace.explainee.query : JSON.stringify(trace.explainee)
    });
    event.preventDefault();
  }

  return (
    <TraceNavContext.Provider value={[state, setState]}>
      <div>
        <Button className='nav-button' variant="link" onClick={hideAll}>hide all</Button>{' | '}
        <Button className='nav-button' variant="link" onClick={showAll}>show all</Button>{' | '}
        <Button className='nav-button' variant="link" onClick={showSQL}>show SQL</Button>
      </div>
      <TraceNavChildren children={[root]} parentId={-1} />
      <div>
        Key-based navigation:
        <ul>
          <li>(<strong>p</strong>)revious item</li>
          <li>(<strong>n</strong>)ext item</li>
          <li>(<strong>c</strong>)opy current item to clipboard</li>
        </ul>
      </div>
    </TraceNavContext.Provider >
  );
}

function TraceNavChildren({ children, parentId }) {
  const [state] = useContext(TraceNavContext);

  let items = children.map((node) => {
    return <TraceNavNode node={node} key={node.id} />
  }).reverse();

  return (
    <ul className={state.closed.includes(parentId) ? "trace-nav trace-nav-closed" : "trace-nav"}>
      {items}
    </ul>
  );
}

function TraceNavNode({ node }) {
  const [state, setState] = useContext(TraceNavContext);
  const [trace] = useContext(TraceContext);
  const [explorerState, setExplorerState] = useContext(TraceExplorerContext);

  const showPlan = (event) => {
    const id = parseInt(event.target.getAttribute("data-focus"));
    setState({
      ...state,
      active: id
    });
    setExplorerState({
      ...explorerState,
      path: trace.index[id].path,
      plan: trace.index[id].plan
    });
    event.preventDefault();
  }

  const toggleMenu = (event) => {
    const id = parseInt(event.target.getAttribute("data-toggle"));
    if (state.closed.includes(id)) {
      setState({
        closed: state.closed.filter(x => x !== id)
      });
    } else {
      setState({
        ...state,
        closed: [...state.closed, id]
      });
    }
  }

  const segment = node.path.split('/').pop();

  const link = node.noop
    ? <span>{segment}</span>
    : <Button
      className="nav-button" variant="link"
      active={state.active !== undefined && state.active === node.id} data-focus={node.id}
      onClick={showPlan}>{segment}</Button>;

  if (node.children?.length > 0) {
    return <li>
      <span className={state.closed.includes(node.id) ? "caret" : "caret caret-open"} onClick={toggleMenu} data-toggle={node.id} />
      <CopyToClipboard text={node.path + '\n' + node.plan}><a href={'#' + node.path} onClick={e => e.preventDefault()}>⎘</a></CopyToClipboard>{' '}
      {link}
      <TraceNavChildren children={node.children} parentId={node.id} />
    </li>;
  } else {
    return <li>
      <span className="nocaret" />
      <CopyToClipboard text={node.path + '\n' + node.plan}><a href={'#' + node.path} onClick={e => e.preventDefault()}>⎘</a></CopyToClipboard>{' '}
      {link}
    </li>;
  }
}

// TODO: use diff-based view here. Explored options are:
// 1) http://incaseofstairs.com/jsdiff/
// TODO: use dot view. Shortlisted options are:
// 2) https://www.npmjs.com/package/vis-react (demo at https://codesandbox.io/s/3vvy7xqo9m?file=/src/index.js)
function TraceView() {
  const [explorer_state] = useContext(TraceExplorerContext);

  return (
    <Row id="explorer">
      <Col>
        <h4>{explorer_state.path}</h4>
        <pre><code>{explorer_state.plan}</code></pre>
      </Col>
    </Row>
  );
}

// React hook for key-based navigation.
// Taken from https://codesandbox.io/s/react-hooks-navigate-list-with-keyboard-eowzo.
const useKeyPress = function (targetKey) {
  const [keyPressed, setKeyPressed] = useState(false);

  function downHandler({ key }) {
    if (key === targetKey) {
      setKeyPressed(true);
    }
  }

  const upHandler = ({ key }) => {
    if (key === targetKey) {
      setKeyPressed(false);
    }
  };

  React.useEffect(() => {
    window.addEventListener("keydown", downHandler);
    window.addEventListener("keyup", upHandler);

    return () => {
      window.removeEventListener("keydown", downHandler);
      window.removeEventListener("keyup", upHandler);
    };
  });

  return keyPressed;
};