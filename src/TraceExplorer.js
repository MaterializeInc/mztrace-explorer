import { diffArrays, diffWords } from 'diff';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Alert, Button, Col, Container, Form, Row } from 'react-bootstrap';
import { ArrowsCollapse, ArrowsExpand, BootstrapReboot, Copy, FileArrowDown, FileDiff, FiletypeSql } from 'react-bootstrap-icons';
import { CopyToClipboard } from 'react-copy-to-clipboard';


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
              <Alert.Heading>Error while loading trace!</Alert.Heading>
              <pre>{trace.error}</pre>
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
  const [state, setState] = useState({ active: 0, closed: [], hideNoop: false });

  // key-based navigation state
  const nextKeyPress = useKeyPress("n");
  const prevKeyPress = useKeyPress("p");
  const copyKeyPress = useKeyPress("c");

  // key-based navigation handlers
  useEffect(() => {
    if (nextKeyPress && state.active !== undefined) {
      const currPlan = trace.index.at(state.active).plan;
      const slice = trace.index.slice(state.active, trace.index.length);
      const offset = slice.findIndex(entry => !entry.noop && entry.plan !== currPlan);
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
            id: id,
            path: trace.index[id].path,
            plan: trace.index[id].plan,
            time: trace.index[id].time
          }
        ].slice(-2)
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextKeyPress, trace]);

  useEffect(() => {
    if (prevKeyPress && state.active !== undefined) {
      const currPlan = trace.index.at(state.active).plan;
      const slice = trace.index.slice(0, state.active);
      const offset = slice.findLastIndex((entry, index) => !entry.noop && entry.plan !== currPlan && entry.plan !== slice.at(index - 1)?.plan);
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
            id: id,
            path: trace.index[id].path,
            plan: trace.index[id].plan,
            time: trace.index[id].time
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

  const resetExplorer = (event) => {
    setExplorerState(explorerState => ({
      ...explorerState,
      plans: []
    }));
    event.preventDefault();
  }

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
          id: undefined,
          path: "SQL query",
          plan: trace.explainee.query ? trace.explainee.query : JSON.stringify(trace.explainee),
          time: ""
        }
      ]
    }));
    event.preventDefault();
  }

  const download = (event) => {
    // data
    const data = new Blob([JSON.stringify({
      explainee: trace.explainee,
      list: trace.index.map(entry => ({
        "id": entry.id,
        "time": entry.time,
        "path": entry.path,
        "plan": entry.plan,
      })),
    }, null, 4)], { type: "text/plain" });
    // create and click download link
    const link = document.createElement("a");
    link.download = trace.version ? `trace.${trace.version}.json` : 'trace.json';
    link.href = URL.createObjectURL(new Blob([data], { type: "text/plain" }));
    link.click();
    link.remove();
    // prevent default action
    event.preventDefault();
  }

  const toggleNoop = (event) => {
    setState({
      ...state,
      hideNoop: !state.hideNoop
    });
  }

  return (
    <TraceNavContext.Provider value={[state, setState]}>
      <div className="trace-nav-top">
        <Button className='nav-button' variant="outline-primary" size="sm" onClick={resetExplorer}><BootstrapReboot title="reset" /></Button>
        <Button className='nav-button' variant="outline-primary" size="sm" onClick={hideAll}><ArrowsCollapse title="hide all" /></Button>
        <Button className='nav-button' variant="outline-primary" size="sm" onClick={showAll}><ArrowsExpand title="show all" /></Button>
        <Button className='nav-button' variant="outline-primary" size="sm" onClick={toggleNoop}><FileDiff title="togle empty diff stages" /></Button>
        <Button className='nav-button' variant="outline-primary" size="sm" onClick={showSQL}><FiletypeSql title="show explainee" /></Button>
        <Button className='nav-button' variant="outline-primary" size="sm" onClick={download}><FileArrowDown title="download trace as file" /></Button>
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
          id: id,
          path: trace.index[id].path,
          plan: trace.index[id].plan,
          time: trace.index[id].time
        }
      ].slice(-2)
    });
    event.preventDefault();
  }

  const toggleMenu = (event) => {
    const id = parseInt(event.target.getAttribute("data-toggle"));
    if (state.closed.includes(id)) {
      setState({
        ...state,
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

  var linkClass;
  if (explorerState.plans.at(-1)?.id === explorerState.plans.at(-2)?.id) {
    linkClass="nav-button";
  } else if (explorerState.plans.at(-1)?.id === node.id) {
    linkClass="nav-button diff-rhs";
  } else if (explorerState.plans.at(-2)?.id === node.id) {
    linkClass="nav-button diff-lhs";
  } else {
    linkClass="nav-button";
  }

  const link = node.noop
    ? <span>{segment}</span>
    : <Button
        variant="link" className={linkClass}
        active={state.active !== undefined && state.active === node.id}
        data-focus={node.id}
        onClick={showPlan}>{segment}</Button>;

  if (node.children?.length > 0) {
    return <li className={state.hideNoop && node.noop ? "d-none" : ""}>
      <span className={state.closed.includes(node.id) ? "caret" : "caret caret-open"} onClick={toggleMenu} data-toggle={node.id} />
      <CopyToClipboard text={node.path + '\n' + node.plan}><a href={'#' + node.path} onClick={e => e.preventDefault()}>
        <Copy title="copy plan to clipboard" size="0.8em" /></a>
      </CopyToClipboard>{' '}
      {link}
      <TraceNavChildren children={node.children} parentId={node.id} />
    </li>;
  } else {
    return <li className={state.hideNoop && node.noop ? "d-none" : ""}>
      <span className="nocaret" />
      <CopyToClipboard text={node.path + '\n' + node.plan}><a href={'#' + node.path} onClick={e => e.preventDefault()}>
        <Copy title="copy plan to clipboard" size="0.8em" /></a>
      </CopyToClipboard>{' '}
      {link}
    </li>;
  }
}

// TODO: use diff-based view here. Explored options are:
// 1) http://incaseofstairs.com/jsdiff/
// TODO: use dot view. Shortlisted options are:
// 2) https://www.npmjs.com/package/vis-react (demo at https://codesandbox.io/s/3vvy7xqo9m?file=/src/index.js)
function TraceView() {
  const [trace] = useContext(TraceContext);
  const [explorerState] = useContext(TraceExplorerContext);
  const [showAttrs, setShowAttrs] = useState(false);
  // key-based navigation state
  const vbarOffsetDecKeyPress = useKeyPress("d");
  const vbarOffsetIncKeyPress = useKeyPress("i");

  // key-based navigation handlers
  useEffect(() => {
    if (vbarOffsetDecKeyPress && explorerState.vbarOffset > 0) {
      explorerState.vbarOffset -= 1;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vbarOffsetDecKeyPress, explorerState.vbarOffset]);
  useEffect(() => {
    if (vbarOffsetIncKeyPress) {
      explorerState.vbarOffset += 1;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vbarOffsetIncKeyPress, explorerState.vbarOffset]);

  const vbar = "  ".repeat(explorerState.vbarOffset);

  console.assert(explorerState.plans.length <= 2, "Explorer state has less than two plans");

  if (explorerState.plans.length > 0) { // 1 or 2 plans
    const [lhs, rhs] = [explorerState.plans.at(0), explorerState.plans.at(-1)]; // might be the same

    const path = diffWords(lhs.path, rhs.path).map((part, i) => {
      const type = part.added ? 'ins' : part.removed ? 'del' : 'same';
      const span = <span key={`plan-span-${i}`} className={type}>{part.value}</span>;
      return span;
    });

    const lhs_lines = lhs.plan.trim().split(/\n/);
    const rhs_lines = rhs.plan.trim().split(/\n/);
    const cmp_lines = (l, r) => l.trimStart() === r.trimStart();
    var line_no = 1;
    const plan = diffArrays(lhs_lines, rhs_lines, { comparator: cmp_lines }).flatMap((part) => {
      const type = part.added ? 'ins' : part.removed ? 'del' : 'same';
      return part.value.map(line => {
        const attributes_pos = line.match(new RegExp(String.raw`( // {.+})$`))?.index || line.length;
        return (
          <div key={`diff-l${line_no++}`} className={type}>
            <span>{line.slice(0, attributes_pos)}</span>
            <span className="attributes">{line.slice(attributes_pos)}</span>
            <span>{'\n'}</span>
          </div>
        );
      });
    });

    const timeType = (lhs?.id === rhs?.id)
      ? "stage duration"
      : "cumulative time of all simple stages between the two selected";
    const time = formatDuration(diffTime(lhs, rhs, trace.index));

    return (
      <>
        <Row id="explorer">
          <Col>
            <h4>{path}</h4>
            <p>t={time} ({timeType})</p>
            <pre><code className="vbar">{vbar}</code><code className={showAttrs ? 'plan' : 'plan noattrs'}>{plan}</code></pre>
          </Col>
        </Row>
        <Row>
          <Col>
            <Form.Check type="switch" id="custom-switch" isValid={showAttrs} onChange={(_) => setShowAttrs(toggle => !toggle)} label="Show all attributes" />
          </Col>
        </Row>
      </>
    );
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
          <p>Press the <BootstrapReboot title="reset" /> button on the top of the navigation bar to see this page again.</p>
        </Col>
      </Row>
    );
  }
}

// React hook for key-based navigation.
// Taken from https://codesandbox.io/s/react-hooks-navigate-list-with-keyboard-eowzo.
const useKeyPress = function (targetKey) {
  const [keyPressed, setKeyPressed] = useState(false);

  function downHandler(e) {
    if (e.key === targetKey && !e.ctrlKey) {
      setKeyPressed(true);
    }
  }

  const upHandler = (e) => {
    if (e.key === targetKey && !e.ctrlKey) {
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

/* Format a duration given in nanoseconds into a human-readable string. */
function diffTime(lhs, rhs, index) {
  if (lhs?.id === undefined && rhs?.id === undefined) {
    return undefined;
  }
  if (lhs.id === rhs.id) {
    return lhs.time;
  }

  let min_id = Math.min(lhs.id, rhs.id);
  let max_id = Math.max(lhs.id, rhs.id);

  let time = 0;
  for (let i = min_id + 1; i <= max_id; i++) {
    // Add together non-composite stages.
    if (index[i]?.children?.length === 0) {
      time += parseInt(index[i].time);
    }
  }

  return time;
}

/* Format a duration given in nanoseconds into a human-readable string. */
function formatDuration(time) {
  // Exit early if the given time is undefined or zero.
  if (time === undefined) {
    return `undefined`;
  }
  if (time === 0) {
    return `0ns`;
  }

  // Decompose the time in second and sub-second units.
  let [ns, µs, ms, s] = [0, 1, 2, 3];
  let units = new Array(4).fill(0);
  for (let i = 0; i < 4; i++) {
    units[i] = time % 1000;
    time -= units[i];
    time /= 1000;
  }

  // Compute whole part (x), fractional part (f), and units (u).
  let x, f, u;
  if (units[s]) {
    x = units[s];
    f = units[ms] * 1_000_000 + units[µs] * 1_000 + units[ns]
    u = "s";
  } else if (units[ms]) {
    x = units[ms];
    f = units[µs] * 1_000 + units[ns]
    u = "ms";
  } else if (units[µs]) {
    x = units[µs];
    f = units[ns]
    u = "µs";
  } else {
    x = units[ns];
    f = 0;
    u = "ns";
  }

  if (f) {
    return `${x}.${f}${u}`;
  } else {
    return `${x}${u}`;
  }
}
