import React from 'react';
import ReactDOM from 'react-dom/client';

import 'bootstrap/dist/css/bootstrap.min.css';

import App from './App';

const tree = {
  path: "optimize",
  plan: "Get t4",
  id: 4,
  children: [
    {
      path: "optimize.local",
      plan: "Get t2",
      id: 2,
      children: [
        {
          path: "optimize.local.logical",
          plan: "Get t0",
          id: 0
        },
        {
          path: "optimize.local.physical",
          plan: "Get t1",
          id: 1
        },
      ]
    },
    {
      path: "optimize.global",
      plan: "Get t3",
      id: 3
    },
  ]
}

const trace = {
  tree: tree,
  index: postOrder(tree)
}

function postOrder(tree) {
  if (tree.children) {
    return tree.children.flatMap(child => postOrder(child)).concat([tree]);
  } else {
    return [tree];
  }
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App trace={trace} />
  </React.StrictMode>
);

