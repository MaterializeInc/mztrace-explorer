import React, { createContext, useContext, useEffect, useState } from 'react';
import { Alert, Button, Col, Container, Row } from 'react-bootstrap';
import { CopyToClipboard } from 'react-copy-to-clipboard';
import { diffWords, diffLines } from 'diff';

import { TraceContext } from './App';

import './TraceExplorer.css';

const TraceExplorerContext = createContext();

export default function TraceExplorer() {
  const [trace] = useContext(TraceContext);
  const [state, setState] = useState({ plans: [], vbarOffset: 0 });

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
  const setExplorerState = useContext(TraceExplorerContext).at(1);
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
        plans: [
          ...explorerState.plans,
          {
            path: trace.index[id].path,
            plan: trace.index[id].plan
          }
        ].slice(-2)
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
        plans: [
          ...explorerState.plans,
          {
            path: trace.index[id].path,
            plan: trace.index[id].plan
          }
        ].slice(-2)
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
    setExplorerState(explorerState => ({
      ...explorerState,
      plans: [
        {
          path: "SQL query",
          plan: trace.explainee.query ? trace.explainee.query : JSON.stringify(trace.explainee)
        }
      ]
    }));
    event.preventDefault();
  }

  const resetExplorer = (event) => {
    setExplorerState(explorerState => ({
      ...explorerState,
      plans: []
    }));
    event.preventDefault();
  }

  return (
    <TraceNavContext.Provider value={[state, setState]}>
      <div>
        <Button className='nav-button' variant="link" onClick={resetExplorer}>reset</Button>{' | '}
        <Button className='nav-button' variant="link" onClick={hideAll}>hide all</Button>{' | '}
        <Button className='nav-button' variant="link" onClick={showAll}>show all</Button>{' | '}
        <Button className='nav-button' variant="link" onClick={showSQL}>show SQL</Button>
      </div>
      <TraceNavChildren children={[root]} parentId={-1} />
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
      plans: [
        ...explorerState.plans,
        {
          path: trace.index[id].path,
          plan: trace.index[id].plan
        }
      ].slice(-2)
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
  // key-based navigation state
  const vbarOffsetDecKeyPress = useKeyPress("d");
  const vbarOffsetIncKeyPress = useKeyPress("i");

  // key-based navigation handlers
  useEffect(() => {
    if (vbarOffsetDecKeyPress && explorer_state.vbarOffset > 0) {
      explorer_state.vbarOffset -= 1;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vbarOffsetDecKeyPress, explorer_state.vbarOffset]);
  useEffect(() => {
    if (vbarOffsetIncKeyPress) {
      explorer_state.vbarOffset += 1;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vbarOffsetIncKeyPress, explorer_state.vbarOffset]);

  const vbar = "  ".repeat(explorer_state.vbarOffset);
  let path = "";
  let plan = "";

  if (explorer_state.plans.length === 1) {
    path = explorer_state.plans[0].path;
    plan = explorer_state.plans[0].plan;
  } else if (explorer_state.plans.length === 2) {
    const [lhs, rhs] = explorer_state.plans;

    path = diffWords(lhs.path, rhs.path).map((part, i) => {
      const type = part.added ? 'ins' : part.removed ? 'del' : 'same';
      const span = <span key={`plan-span-${i}`} className={type}>{part.value}</span>;
      return span;
    });

    plan = diffLines(lhs.plan, rhs.plan, { "ignoreWhitespace": false }).map((part, i) => {
      const type = part.added ? 'ins' : part.removed ? 'del' : 'same';
      const span = <span key={`path-span-${i}`} className={type}>{part.value}</span>;
      return span;
    });
  } else {
    return (
      <Row id="explorer">
        <Col>
          <h4>Key-based navigation</h4>
          <p>Use the following keys to navigate the trace.</p>
          <ul>
            <li>(<strong>p</strong>)revious item</li>
            <li>(<strong>n</strong>)ext item</li>
            <li>(<strong>c</strong>)opy current item to clipboard</li>
            <li>(<strong>d</strong>)ecrement vertical guide</li>
            <li>(<strong>i</strong>)ncrement vertical guide</li>
          </ul>
          <p>Press the <strong>reset</strong> button on the top of the navigation bar to see this page again.</p>
        </Col>
      </Row>
    );
  }

  return (
    <Row id="explorer">
      <Col>
        <h4>{path}</h4>
        <pre><code className="vbar">{vbar}</code><code className="plan">{plan}</code></pre>
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