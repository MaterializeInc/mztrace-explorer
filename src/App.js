import React, { createContext, useState } from 'react';
import { Container, Row, Col } from 'react-bootstrap';

import TraceExplorer from './TraceExplorer';

export const TraceContext = createContext();

export default function App(props) {
  const [trace, setTrace] = useState(props.trace);

  return (
    <TraceContext.Provider value={[trace, setTrace]}>
      <Container fluid>
        <Row className="justify-content-md-center">
          <Col md="auto">
            <h1>Materialize <code>EXPLAIN</code> trace explorer</h1>
          </Col>
        </Row>
        <TraceExplorer />
      </Container>
    </TraceContext.Provider>
  );
}
