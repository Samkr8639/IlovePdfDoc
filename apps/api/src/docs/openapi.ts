export const openApiSpec = {
  openapi: '3.1.0',
  info: {
    title: 'PaperFlow API',
    version: '1.0.0',
    description: 'High-performance, privacy-focused REST API for PDF manipulation and layout-preserving Word conversion.',
    contact: {
      name: 'PaperFlow Team',
      url: 'https://pdfflow.app'
    },
    license: {
      name: 'MIT'
    }
  },
  servers: [
    {
      url: 'http://localhost:4000',
      description: 'Local development server'
    },
    {
      url: 'https://api.pdfflow.app',
      description: 'Production server'
    }
  ],
  tags: [
    { name: 'System', description: 'Health and diagnostics' },
    { name: 'Tools', description: 'Tool registry and capabilities' },
    { name: 'Contact', description: 'Customer support inquiries' },
    { name: 'Compress', description: 'PDF compression services' },
    { name: 'PDF to Word', description: 'Layout-preserving PDF to DOCX conversion' }
  ],
  paths: {
    '/api/v1/health': {
      get: {
        tags: ['System'],
        summary: 'System health check and memory telemetry',
        responses: {
          '200': {
            description: 'Service is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        status: { type: 'string', example: 'healthy' },
                        service: { type: 'string', example: 'paperflow-api' },
                        version: { type: 'string', example: '1.0.0' },
                        uptime: { type: 'number', example: 124.5 },
                        memory: {
                          type: 'object',
                          properties: {
                            rssMb: { type: 'number', example: 128.4 },
                            heapUsedMb: { type: 'number', example: 45.2 }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/v1/tools': {
      get: {
        tags: ['Tools'],
        summary: 'List all supported document tools',
        responses: {
          '200': {
            description: 'Array of tool definitions',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string', example: 'pdf-to-word' },
                          name: { type: 'string', example: 'PDF to Word' },
                          category: { type: 'string', example: 'convert-from-pdf' },
                          executionMode: { type: 'string', example: 'server-assisted' }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/v1/contact': {
      post: {
        tags: ['Contact'],
        summary: 'Submit a customer inquiry ticket',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'email', 'subject', 'message'],
                properties: {
                  name: { type: 'string', example: 'Sameer Kumar' },
                  email: { type: 'string', format: 'email', example: 'sam@zealousys.com' },
                  subject: { type: 'string', example: 'API Enterprise Licensing' },
                  userType: { type: 'string', enum: ['individual', 'company'], default: 'individual' },
                  productInterests: { type: 'array', items: { type: 'string' } },
                  message: { type: 'string', example: 'Inquiring about high-throughput on-premise conversion.' }
                }
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'Inquiry received and ticket issued',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        ticketId: { type: 'string', example: 'TKT-2026-89412' },
                        receivedAt: { type: 'string', format: 'date-time' },
                        estimatedResponseHours: { type: 'number', example: 2 },
                        message: { type: 'string' }
                      }
                    }
                  }
                }
              }
            }
          },
          '400': {
            description: 'Validation error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ApiErrorResponse' }
              }
            }
          },
          '429': {
            description: 'Rate limit exceeded (max 5 per 15 minutes)',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ApiErrorResponse' }
              }
            }
          }
        }
      }
    },
    '/api/v1/compress': {
      post: {
        tags: ['Compress'],
        summary: 'Compress a PDF document',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['file'],
                properties: {
                  file: { type: 'string', format: 'binary' },
                  level: { type: 'string', enum: ['extreme', 'recommended', 'less'], default: 'recommended' }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Compressed PDF file',
            content: {
              'application/pdf': {
                schema: { type: 'string', format: 'binary' }
              }
            }
          },
          '400': {
            description: 'Bad request (empty or invalid PDF)',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ApiErrorResponse' }
              }
            }
          }
        }
      }
    },
    '/api/v1/pdf-to-word/convert': {
      post: {
        tags: ['PDF to Word'],
        summary: 'Convert PDF files to editable DOCX documents with exact visual layout',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['files'],
                properties: {
                  files: {
                    type: 'array',
                    items: { type: 'string', format: 'binary' },
                    description: 'Up to 10 PDF files (max 50MB each)'
                  },
                  mode: {
                    type: 'string',
                    enum: ['no_ocr', 'ocr'],
                    default: 'no_ocr',
                    description: 'no_ocr for native text extraction; ocr for scanned image OCR'
                  },
                  ocrLanguage: {
                    type: 'string',
                    default: 'eng',
                    description: 'Language code for OCR (e.g. eng, spa, fra, deu)'
                  }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Conversion completed successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        id: { type: 'string', format: 'uuid' },
                        status: { type: 'string', example: 'completed' },
                        mode: { type: 'string', example: 'no_ocr' },
                        totalFiles: { type: 'number', example: 1 },
                        files: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              id: { type: 'string' },
                              originalFilename: { type: 'string' },
                              wordFilename: { type: 'string' },
                              originalSizeBytes: { type: 'number' },
                              wordSizeBytes: { type: 'number' },
                              pageCount: { type: 'number' },
                              downloadUrl: { type: 'string' }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          '400': {
            description: 'Validation error (0-byte file, invalid PDF header, too many files)',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ApiErrorResponse' }
              }
            }
          },
          '413': {
            description: 'Payload too large (file exceeds 50MB)',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ApiErrorResponse' }
              }
            }
          },
          '422': {
            description: 'Corrupted or password-protected PDF',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ApiErrorResponse' }
              }
            }
          },
          '429': {
            description: 'Rate limit exceeded (max 60 conversions per 15 minutes)',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ApiErrorResponse' }
              }
            }
          }
        }
      }
    },
    '/api/v1/pdf-to-word/jobs/{jobId}/download': {
      get: {
        tags: ['PDF to Word'],
        summary: 'Download converted Word document (or ZIP if multiple files)',
        parameters: [
          {
            name: 'jobId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' }
          }
        ],
        responses: {
          '200': {
            description: 'DOCX or ZIP binary stream',
            content: {
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
                schema: { type: 'string', format: 'binary' }
              },
              'application/zip': {
                schema: { type: 'string', format: 'binary' }
              }
            }
          },
          '404': {
            description: 'Job expired or not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ApiErrorResponse' }
              }
            }
          }
        }
      }
    }
  },
  components: {
    schemas: {
      ApiErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'INVALID_PDF_HEADER' },
              message: { type: 'string', example: 'Only valid PDF files are supported.' },
              details: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    field: { type: 'string' },
                    issue: { type: 'string' }
                  }
                }
              }
            }
          },
          meta: {
            type: 'object',
            properties: {
              timestamp: { type: 'string', format: 'date-time' }
            }
          }
        }
      }
    }
  }
};
