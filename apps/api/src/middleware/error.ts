import type { ErrorRequestHandler } from 'express';
import multer from 'multer';
import { ZodError } from 'zod';
import { InvalidInputError } from '@ecoproof/calc';
import { AppError } from '../errors.js';

// Express identifies error handlers by their 4-argument arity, so `_next` must stay.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json({ code: err.code, message: err.message, details: err.details });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({ code: 'VALIDATION', message: 'Invalid request', details: err.issues });
    return;
  }
  if (err instanceof multer.MulterError) {
    const tooBig = err.code === 'LIMIT_FILE_SIZE';
    res
      .status(tooBig ? 413 : 400)
      .json({ code: tooBig ? 'FILE_TOO_LARGE' : 'UPLOAD_ERROR', message: err.message });
    return;
  }
  if (err instanceof InvalidInputError) {
    res.status(422).json({ code: 'INVALID_INPUT', message: err.message });
    return;
  }
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ code: 'VALIDATION', message: 'Malformed JSON body' });
    return;
  }
  console.error(err);
  res.status(500).json({ code: 'INTERNAL', message: 'Something went wrong' });
};
