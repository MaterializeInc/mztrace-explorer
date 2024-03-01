import axios from "axios";
import React, { useContext, useState } from 'react';
import { Button, Col, Container, Form, Row, Tab, Tabs } from 'react-bootstrap';

import { TraceContext, completeTraceList, computeNoopFlag, indexTraceTree, toTraceList, toTraceTree } from './App';
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
  const [explainConfig, setExplainConfig] = useState(["arity", "join implementations", "humanized expressions"]);
  const [explainBroken, setExplainBroken] = useState(false);
  const [explaineeRows, setExplaineeRows] = useState(1);

  async function handleSubmit(event) {
    event.preventDefault();

    // endpoint parameters
    const scheme = event.target.generateTraceFromSql_scheme.value;
    const host = event.target.generateTraceFromSql_host.value;
    const port = event.target.generateTraceFromSql_port.value;
    const cluster = event.target.generateTraceFromSql_cluster.value;
    const database = event.target.generateTraceFromSql_database.value;
    const schema = event.target.generateTraceFromSql_schema.value;
    const username = event.target.generateTraceFromSql_username.value;
    const password = event.target.generateTraceFromSql_password.value;
    // request query
    const explainee = event.target.generateTraceFromSql_explainee.value;
    const query = [
      'EXPLAIN OPTIMIZER TRACE',
      explainConfig.length > 0 ? `WITH(${explainConfig.join(", ")}) AS TEXT ` : 'AS TEXT ',
      explainBroken ? 'FOR BROKEN ' : 'FOR ',
      event.target.generateTraceFromSql_explainee.value
    ].join("\n");

    // Construct the URL for the axios request.
    const axios_url = (scheme === 'https' && port === '8080')
      ? `https://${host}/api/sql`
      : `${scheme}://${host}:${port}/api/sql`;

    const axios_data = {
      "query": [
        cluster ? `SET cluster = "${cluster}"` : '',
        database ? `SET database = "${database}"` : '',
        schema ? `SET schema = "${schema}"` : '',
        query
      ].filter((stmt) => stmt !== '').join(";\n")
    };

    // Construct the parameters for the axios request.
    let axios_config = {
      headers: {
        'Content-Type': 'application/json'
      }
    };
    if (username || password) {
      axios_config['auth'] = {
        username: username,
        password: password
      };
    }

    await axios.post(axios_url, axios_data, axios_config).then(function (response) {
      try {
        const results = response.data.results.at(-1);

        if (results.error) {
          throw results.error;
        }

        if (results.rows === undefined) {
          throw new Error("results.rows is not defined");
        }

        const list = completeTraceList(toTraceList(results));
        const tree = toTraceTree(list);
        const index = indexTraceTree(tree);

        // mark nodes with a plan identical to their predecessor with 'noop: true'
        computeNoopFlag(index);

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
        console.log(error);
        setTrace({
          error: JSON.stringify(error, undefined, 2)
        });
      }
    }).catch(function (error) {
      console.log(error);
      setTrace({
        error: JSON.stringify(error, undefined, 2)
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

  const toggleExplainBroken = () => {
    setExplainBroken(explainBroken => !explainBroken);
  };

  const explainConfigOptions = [
    {
      key: "linear chains",
      label: <>Restrict output trees to linear chains. Ignored if <code>raw_plans</code> is set.</>
    },
    {
      key: "no fast path",
      label: <>Show the slow path plan even if a fast path plan was created. Useful for debugging.</>
    },
    {
      key: "raw plans",
      label: <>Don't normalize plans before explaining them.</>
    },
    {
      key: "raw syntax",
      label: <>Disable virtual syntax in the explanation.</>
    },
    {
      key: "join implementations",
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
      key: "non negative",
      label: <>Annotate sub-plans with their <code>non_negative</code> value.</>
    },
    {
      key: "subtree size",
      label: <>Annotate sub-plans with their <code>subtree_size</code> value.</>
    },
    {
      key: "timing",
      label: <>Print optimization timings after each stage.</>
    },
    {
      key: "filter pushdown",
      label: <>Show MFP pushdown information.</>
    },
    {
      key: "cardinality",
      label: <>Show cardinality information.</>
    },
    {
      key: "column names",
      label: <>Show inferred column names.</>
    },
    {
      key: "humanized expressions",
      label: <>Use inferred column names when rendering scalar and aggregate expressions.</>
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
              <Form.Check.Input checked={explainConfig.includes(item.key)} isValid={explainConfig.includes(item.key)} onChange={handleConfigChange} />
              <Form.Check.Label>{item.label}</Form.Check.Label>
            </Form.Check>
          ))}
        </Col>
      </Form.Group>
      <Form.Group as={Row} className="mb-3" controlId="generateTraceFromSql_explainConfig">
        <Form.Label column sm={3}>Explain broken plan</Form.Label>
        <Col sm={9}>
          <Form.Check type="switch" id="generateTraceFromSql_explainBroken">
            <Form.Check.Input checked={explainBroken} isValid={explainBroken} onChange={toggleExplainBroken} />
            <Form.Check.Label>Supress optimizer pipeline panics.</Form.Check.Label>
          </Form.Check>
        </Col>
      </Form.Group>
      <Form.Group as={Row} className="mb-3">
        <Form.Label column sm={3}>Address</Form.Label>
        <Col sm={1}>
          <Form.Control type="input" id="generateTraceFromSql_scheme" defaultValue="http" placeholder="scheme" />
        </Col>
        <Col sm={7}>
          <Form.Control type="input" id="generateTraceFromSql_host" defaultValue="localhost" placeholder="host" />
        </Col>
        <Col sm={1}>
          <Form.Control type="input" id="generateTraceFromSql_port" defaultValue="6876" placeholder="port" />
        </Col>
      </Form.Group>
      <Form.Group as={Row} className="mb-3">
        <Form.Label column sm={3}>Namespace</Form.Label>
        <Col sm={3}>
          <Form.Control type="input" id="generateTraceFromSql_cluster" defaultValue="" placeholder="cluster" />
        </Col>
        <Col sm={3}>
          <Form.Control type="input" id="generateTraceFromSql_database" defaultValue="" placeholder="database" />
        </Col>
        <Col sm={3}>
          <Form.Control type="input" id="generateTraceFromSql_schema" defaultValue="" placeholder="schema" />
        </Col>
      </Form.Group>
      <Form.Group as={Row} className="mb-3">
        <Form.Label column sm={3}>Authentication</Form.Label>
        <Col sm={4}>
          <Form.Control type="input" id="generateTraceFromSql_username" placeholder="username" />
        </Col>
        <Col sm={4}>
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
        // Ensure that the list entries are ordered by id
        trace.list.sort((a, b) => (a.id > b.id) ? 1 : -1);

        const list = completeTraceList(trace.list);
        const tree = toTraceTree(list);
        const index = indexTraceTree(tree);

        // mark nodes with a plan identical to their predecessor with 'noop: true'
        computeNoopFlag(index);

        // If everything is fine the index should be for the same number of entries
        // and for the same sequence of paths (we check only the former here).
        console.assert(list.length === index.length, "Trace list and trace index sizes don't match.");

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