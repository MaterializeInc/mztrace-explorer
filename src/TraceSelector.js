import axios from "axios";
import React, { useContext, useState } from 'react';
import { Button, Col, Container, Form, Row, Tab, Tabs } from 'react-bootstrap';

import { TraceContext, computeActiveFlag, toTraceTree, indexTraceTree } from './App';

import './TraceSelector.css';

export default function TraceSelector(props) {
  const [key, setKey] = useState("from-a-query");

  return (
    <Container>
      <Row>
        <Col>
          <Tabs id="trace-selector" activeKey={key} onSelect={setKey}>
            <Tab eventKey="from-a-query" title="From a SQL query">
              <GenerateTraceFromSQL nextStep={props.nextStep} />
            </Tab>
            <Tab eventKey="from-a-file" title="From a local file">
              <UploadTraceFile nextStep={props.nextStep} />
            </Tab>
            <Tab eventKey="from-a-repo" title="From a GitHub repository" disabled={true} />
          </Tabs>
        </Col>
      </Row>
    </Container >
  );
}

function GenerateTraceFromSQL(props) {
  const setTrace = useContext(TraceContext).at(1);
  const [explainConfig, setExplainConfig] = useState(["arity", "join_impls"]);
  const [explaineeRows, setExplaineeRows] = useState(1);

  async function handleSubmit(event) {
    event.preventDefault();

    // endpoint parameters
    const scheme = event.target.generateTraceFromSql_scheme.value;
    const host = event.target.generateTraceFromSql_host.value;
    const port = event.target.generateTraceFromSql_port.value;
    const username = event.target.generateTraceFromSql_username.value;
    const password = event.target.generateTraceFromSql_password.value;
    // request query
    const explainee = event.target.generateTraceFromSql_explainee.value;
    const query = [
      'EXPLAIN OPTIMIZER TRACE',
      explainConfig.length > 0 ? `WITH(${explainConfig.join(", ")}) AS TEXT FOR` : 'AS TEXT FOR',
      event.target.generateTraceFromSql_explainee.value
    ].join("\n");

    await axios({
      method: 'post',
      url: `${scheme}://${host}:${port}/api/sql`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${(username + ":" + password).toString('base64')}`
      },
      data: JSON.stringify({
        "query": query
      })
    }).then(function (response) {
      try {
        const results = response.data.results[0];

        if (results.error) {
          throw results.error;
        }

        if (results.rows === undefined) {
          throw new Error("results.rows is not defined");
        }

        const list = results.rows.map(([time, path, plan], id) => ({
          id, time, path, plan
        }));

        const tree = toTraceTree(list);
        const index = indexTraceTree(tree);

        // mark nodes with a plan identical to their predecessor with 'noop: true'
        computeActiveFlag(index);

        // If everything is fine the index should be for the same number of entries
        // and for the same sequence of paths (we check only the former here).
        console.assert(list.length === index.length, "Trace list and trace index sizes don't match.");

        setTrace({
          explainee: explainee.toLowerCase().startsWith('view ') ? {
            view: explainee.slice(5)
          } : {
            query: explainee
          },
          tree: tree,
          index: index
        });
      } catch (error) {
        setTrace({
          error: error.toString()
        });
      }
    }).catch(function (error) {
      setTrace({
        error: error.toString()
      });
    });

    props.nextStep();
  };

  const handleExplaineeChange = (event) => {
    const rows = (event.target.value.match(/\n/g) || []).length + 1;
    if (explaineeRows !== rows) {
      setExplaineeRows(rows);
    }
  };

  const handleConfigChange = (event) => {
    const id = event.target.id;
    if (explainConfig.includes(id)) {
      setExplainConfig(explainConfig.filter(option => option !== id));
    } else {
      setExplainConfig([...explainConfig, id]);
    }
  };

  const explainConfigOptions = [
    {
      key: "linear_chains",
      label: <>Restrict output trees to linear chains. Ignored if <code>raw_plans</code> is set.</>
    },
    {
      key: "no_fast_path",
      label: <>Show the slow path plan even if a fast path plan was created. Useful for debugging.</>
    },
    {
      key: "raw_plans",
      label: <>Don't normalize plans before explaining them.</>
    },
    {
      key: "raw_syntax",
      label: <>Disable virtual syntax in the explanation.</>
    },
    {
      key: "join_impls",
      label: <>Render implemented MIR <code>Join</code> nodes in a way which reflects the implementation.</>
    },
    {
      key: "arity",
      label: <>Annotate sub-plans with their arity.</>
    },
    {
      key: "keys",
      label: <>Annotate sub-plans with their unique keys.</>
    },
    {
      key: "types",
      label: <>Annotate sub-plans with their relation type.</>
    },
    {
      key: "non_negative",
      label: <>Annotate sub-plans with their <code>non_negative</code> value.</>
    },
    {
      key: "subtree_size",
      label: <>Annotate sub-plans with their <code>subtree_size</code> value.</>
    },
  ];

  return (
    <Form className="trace-selector-form" onSubmit={handleSubmit}>
      <Form.Group as={Row} className="mb-3" controlId="generateTraceFromSql_explainee">
        <Form.Label column sm={3}>Explainee</Form.Label>
        <Col sm={9}>
          <Form.Control as="textarea" rows={explaineeRows} defaultValue="SELECT 1" placeholder="SELECT 1" onChange={handleExplaineeChange} />
        </Col>
      </Form.Group>
      <Form.Group as={Row} className="mb-3" controlId="generateTraceFromSql_explainConfig">
        <Form.Label column sm={3}>Set <code>WITH</code> options</Form.Label>
        <Col sm={9}>
          {explainConfigOptions.map((item) => (
            <Form.Check key={item.key} type="switch" id={item.key}>
              <Form.Check.Input checked={explainConfig.includes(item.key) ? "checked" : undefined} isValid={explainConfig.includes(item.key)} onChange={handleConfigChange} />
              <Form.Check.Label>{item.label}</Form.Check.Label>
            </Form.Check>
          ))}
        </Col>
      </Form.Group>
      <Form.Group as={Row} className="mb-3">
        <Form.Label column sm={3}>Server</Form.Label>
        <Col sm={1}>
          <Form.Control type="input" id="generateTraceFromSql_scheme" defaultValue="http" placeholder="http" />
        </Col>
        <Col sm={6}>
          <Form.Control type="input" id="generateTraceFromSql_host" defaultValue="localhost" placeholder="host" />
        </Col>
        <Col sm={1}>
          <Form.Control type="input" id="generateTraceFromSql_port" defaultValue="6876" placeholder="port" />
        </Col>
      </Form.Group>
      <Form.Group as={Row} className="mb-3">
        <Form.Label column sm={3}>Authentication</Form.Label>
        <Col sm={4}>
          <Form.Control type="input" id="generateTraceFromSql_username" placeholder="username" />
        </Col>
        <Col sm={5}>
          <Form.Control type="password" id="generateTraceFromSql_password" placeholder="password" />
        </Col>
      </Form.Group>
      <Form.Group as={Row} className="mb-3" controlId="generateTraceFromSql_submit">
        <Form.Label column sm={3}></Form.Label>
        <Col sm={9}>
          <Button type="submit">Get the trace!</Button>{' '}
          <Form.Text>
            You might have to install a browser plugin such as <a href="https://mybrowseraddon.com/access-control-allow-origin.html">Allow CORS</a> to make this work.
          </Form.Text>
        </Col>
      </Form.Group>
    </Form>
  );
}

function UploadTraceFile(props) {
  const setTrace = useContext(TraceContext).at(1);

  const handleFileChange = (event) => {
    const fileReader = new FileReader();

    fileReader.readAsText(event.target.files[0], "UTF-8");
    fileReader.onload = (event) => {
      try {
        const trace = JSON.parse(event.target.result);

        const tree = toTraceTree(trace.list);
        const index = indexTraceTree(tree);

        // mark nodes with a plan identical to their predecessor with 'noop: true'
        computeActiveFlag(index);

        // If everything is fine the index should be for the same number of entries
        // and for the same sequence of paths (we check only the former here).
        console.assert(trace.list.length === index.length, "Trace list and trace index sizes don't match.");

        setTrace({
          explainee: trace.explainee,
          tree: tree,
          index: index
        });
      } catch (error) {
        setTrace({
          error: error.toString()
        });
      }

      props.nextStep();
    };
  };

  return (
    <Form className="trace-selector-form">
      <Form.Group as={Row} className="mb-3" controlId="uploadTraceFile.traceFile">
        <Form.Label column sm={3}>Upload a <code>*.json</code> trace file</Form.Label>
        <Col sm={9}>
          <Form.Control type="file" placeholder="Upload trace" onChange={handleFileChange} />
        </Col>
      </Form.Group>
    </Form>
  );
}