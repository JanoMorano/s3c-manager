'use strict';

const express = require('express');
const request = require('supertest');

jest.mock('../middleware/auth', () => ({ requireAuth: (req, res, next) => next() }));
jest.mock('../middleware/rbac', () => ({ canAdmin: (req, res, next) => next() }));
jest.mock('../db/groups.repo', () => ({ getGroup: jest.fn(async () => null) }));

describe('group routes', () => {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/admin', require('../routes/groups'));

    test.each(['DEMO-IAM-002', 'abc', '0', '1.5'])('non-integer group id %s is a 400', async (id) => {
        const response = await request(app).get(`/api/v1/admin/groups/${id}`);
        expect(response.status).toBe(400);
    });

    test('numeric group id reaches the handler', async () => {
        const response = await request(app).get('/api/v1/admin/groups/7');
        expect(response.status).toBe(404);
    });
});
