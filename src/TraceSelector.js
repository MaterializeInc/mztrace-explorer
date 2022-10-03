import React, { useContext } from 'react';
import { Col, Container, Form, Row } from 'react-bootstrap';

import { TraceContext, computeActiveFlag, toTraceTree, indexTraceTree } from './App';

export default function TraceSelector(props) {
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
        console.assert(trace.list.length === index.length, "Trace list and trace index sizesdon't match.");

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
    <Container>
      <Row>
        <Col>
          <Form>
            <Form.Group as={Row} className="mb-3" controlId="traceFile">
              <Form.Label column sm={3}>Upload local trace</Form.Label>
              <Col sm={9}>
                <Form.Control type="file" placeholder="Upload trace" onChange={handleFileChange} />
              </Col>
            </Form.Group>
          </Form>
        </Col>
      </Row>
    </Container >
  );
}