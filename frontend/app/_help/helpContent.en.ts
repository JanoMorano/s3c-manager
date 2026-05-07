import type { HelpPage } from './types';

export const HELP_PAGES_EN: HelpPage[] = [
  {
    "key": "index",
    "fileName": "index.html",
    "route": "/help-en",
    "locale": "en",
    "title": "S3C Manager - user and administrator manual - S3C Manager Help",
    "body": [
      {
        "text": "\n  "
      },
      {
        "tag": "header",
        "attrs": {
          "class": "site-header"
        },
        "children": [
          {
            "text": "\n    "
          },
          {
            "tag": "a",
            "attrs": {
              "class": "back-to-app",
              "href": "/",
              "aria-label": "Back to application"
            },
            "children": [
              {
                "text": "← Back to application"
              }
            ]
          },
          {
            "text": "\n    "
          },
          {
            "tag": "button",
            "attrs": {
              "class": "hamburger",
              "type": "button",
              "aria-label": "Show menu"
            },
            "children": [
              {
                "text": "☰"
              }
            ]
          },
          {
            "text": "\n    "
          },
          {
            "tag": "a",
            "attrs": {
              "class": "logo",
              "href": "/help-en"
            },
            "children": [
              {
                "text": "S3C Manager"
              },
              {
                "tag": "span",
                "attrs": {},
                "children": [
                  {
                    "text": "Help manual"
                  }
                ]
              }
            ]
          },
          {
            "text": "\n    "
          },
          {
            "tag": "div",
            "attrs": {
              "class": "header-meta"
            },
            "children": [
              {
                "text": "English manual · static HTML · screenshot slots ready"
              }
            ]
          },
          {
            "text": "\n  "
          }
        ]
      },
      {
        "text": "\n  "
      },
      {
        "tag": "div",
        "attrs": {
          "class": "layout"
        },
        "children": [
          {
            "text": "\n\n    "
          },
          {
            "tag": "nav",
            "attrs": {
              "class": "sidebar",
              "id": "sidebar",
              "aria-label": "Help chapters"
            },
            "children": [
              {
                "text": "\n      "
              },
              {
                "tag": "section",
                "attrs": {
                  "class": "sidebar-section",
                  "aria-expanded": "true"
                },
                "children": [
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "button",
                    "attrs": {
                      "class": "sidebar-section-toggle",
                      "type": "button"
                    },
                    "children": [
                      {
                        "text": "Help chapters "
                      },
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "chevron"
                        },
                        "children": [
                          {
                            "text": "▾"
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "div",
                    "attrs": {
                      "class": "sidebar-section-panel"
                    },
                    "children": [
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link active",
                          "href": "/help-en"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "00"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Index"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "index.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/01-install"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "01"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Installation"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "01-install.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/02-welcome"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "02"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Application purpose"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "02-welcome.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/03-cocpit"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "03"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Cockpit"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "03-cocpit.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/04-services"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "04"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Services"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "04-services.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/05-capabilities_c3"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "05"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Capabilities and C3"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "05-capabilities_c3.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/06-governance"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "06"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Governance"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "06-governance.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/07-import"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "07"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Import"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "07-import.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/08-admin"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "08"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Administration"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "08-admin.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/09-user"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "09"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "User"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "09-user.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/10-analysis"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "10"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Analysis"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "10-analysis.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/11-api"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "11"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "API"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "11-api.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/12-abbrevations"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "12"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Abbreviations"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "12-abbrevations.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n        "
                      }
                    ]
                  },
                  {
                    "text": "\n      "
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "div",
                "attrs": {
                  "class": "sidebar-footer"
                },
                "children": [
                  {
                    "text": "The structure is manually maintained. Screenshots belong in "
                  },
                  {
                    "tag": "code",
                    "attrs": {},
                    "children": [
                      {
                        "text": "docs/help-en/img"
                      }
                    ]
                  },
                  {
                    "text": "."
                  }
                ]
              },
              {
                "text": "\n    "
              }
            ]
          },
          {
            "text": "\n    "
          },
          {
            "tag": "main",
            "attrs": {
              "class": "content"
            },
            "children": [
              {
                "text": "\n      "
              },
              {
                "tag": "section",
                "attrs": {
                  "class": "page-hero"
                },
                "children": [
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "p",
                    "attrs": {
                      "class": "chapter-kicker"
                    },
                    "children": [
                      {
                        "text": "Help index"
                      }
                    ]
                  },
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "h1",
                    "attrs": {},
                    "children": [
                      {
                        "text": "S3C Manager - user and administrator manual"
                      }
                    ]
                  },
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "p",
                    "attrs": {
                      "class": "lead"
                    },
                    "children": [
                      {
                        "text": "This manual explains S3C Manager as a governance and decision cockpit for services, capabilities, C3/FMN relations and operational readiness. It is organized by role and by application area so an administrator, service owner, reviewer or architect can find the right information quickly."
                      }
                    ]
                  },
                  {
                    "text": "\n      "
                  }
                ]
              },
              {
                "text": "\n\n      "
              },
              {
                "tag": "h2",
                "attrs": {},
                "children": [
                  {
                    "text": "How to use the manual"
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "p",
                "attrs": {},
                "children": [
                  {
                    "text": "Start with the application overview if you are new to S3C Manager, then continue by role. Every chapter follows the same rhythm: purpose of the screen, what the user sees, field meaning, links to other areas, data impact and recommended workflow."
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "div",
                "attrs": {
                  "class": "index-actions"
                },
                "children": [
                  {
                    "tag": "a",
                    "attrs": {
                      "class": "index-action",
                      "href": "/help-en/02-welcome"
                    },
                    "children": [
                      {
                        "text": "Start with application overview"
                      }
                    ]
                  },
                  {
                    "tag": "a",
                    "attrs": {
                      "class": "index-action",
                      "href": "/help-en/01-install"
                    },
                    "children": [
                      {
                        "text": "Install a new instance"
                      }
                    ]
                  },
                  {
                    "tag": "a",
                    "attrs": {
                      "class": "index-action",
                      "href": "/help-en/04-services"
                    },
                    "children": [
                      {
                        "text": "Manage a service"
                      }
                    ]
                  },
                  {
                    "tag": "a",
                    "attrs": {
                      "class": "index-action",
                      "href": "/help-en/11-api"
                    },
                    "children": [
                      {
                        "text": "Integrate through API"
                      }
                    ]
                  }
                ]
              },
              {
                "text": "\n\n      "
              },
              {
                "tag": "h2",
                "attrs": {},
                "children": [
                  {
                    "text": "Choose your role"
                  }
                ]
              },
              {
                "tag": "div",
                "attrs": {
                  "class": "role-path-grid"
                },
                "children": [
                  {
                    "tag": "article",
                    "attrs": {
                      "class": "role-card"
                    },
                    "children": [
                      {
                        "tag": "h3",
                        "attrs": {},
                        "children": [
                          {
                            "text": "Instance administrator"
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "Installs the instance, manages users, roles, SSO, reference data, imports, API access, repair and operational settings."
                          }
                        ]
                      },
                      {
                        "tag": "div",
                        "attrs": {
                          "class": "role-links"
                        },
                        "children": [
                          {
                            "tag": "a",
                            "attrs": {
                              "href": "/help-en/01-install"
                            },
                            "children": [
                              {
                                "text": "01 Installation"
                              }
                            ]
                          },
                          {
                            "tag": "a",
                            "attrs": {
                              "href": "/help-en/08-admin"
                            },
                            "children": [
                              {
                                "text": "08 Administration"
                              }
                            ]
                          },
                          {
                            "tag": "a",
                            "attrs": {
                              "href": "/help-en/11-api"
                            },
                            "children": [
                              {
                                "text": "11 API"
                              }
                            ]
                          },
                          {
                            "tag": "a",
                            "attrs": {
                              "href": "/help-en/12-abbrevations"
                            },
                            "children": [
                              {
                                "text": "12 Abbreviations"
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "article",
                    "attrs": {
                      "class": "role-card"
                    },
                    "children": [
                      {
                        "tag": "h3",
                        "attrs": {},
                        "children": [
                          {
                            "text": "Service owner"
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "Maintains the service card, offerings, readiness, lifecycle, responsibilities, review state and consumer impact."
                          }
                        ]
                      },
                      {
                        "tag": "div",
                        "attrs": {
                          "class": "role-links"
                        },
                        "children": [
                          {
                            "tag": "a",
                            "attrs": {
                              "href": "/help-en/03-cocpit"
                            },
                            "children": [
                              {
                                "text": "03 Cockpit"
                              }
                            ]
                          },
                          {
                            "tag": "a",
                            "attrs": {
                              "href": "/help-en/04-services"
                            },
                            "children": [
                              {
                                "text": "04 Services"
                              }
                            ]
                          },
                          {
                            "tag": "a",
                            "attrs": {
                              "href": "/help-en/06-governance"
                            },
                            "children": [
                              {
                                "text": "06 Governance"
                              }
                            ]
                          },
                          {
                            "tag": "a",
                            "attrs": {
                              "href": "/help-en/10-analysis"
                            },
                            "children": [
                              {
                                "text": "10 Analysis"
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "article",
                    "attrs": {
                      "class": "role-card"
                    },
                    "children": [
                      {
                        "tag": "h3",
                        "attrs": {},
                        "children": [
                          {
                            "text": "Architect / capability manager"
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "Maps capabilities, C3 items, FMN spirals, applications, data objects, integrations and relations between services."
                          }
                        ]
                      },
                      {
                        "tag": "div",
                        "attrs": {
                          "class": "role-links"
                        },
                        "children": [
                          {
                            "tag": "a",
                            "attrs": {
                              "href": "/help-en/05-capabilities_c3"
                            },
                            "children": [
                              {
                                "text": "05 Capabilities and C3"
                              }
                            ]
                          },
                          {
                            "tag": "a",
                            "attrs": {
                              "href": "/help-en/07-import"
                            },
                            "children": [
                              {
                                "text": "07 Import"
                              }
                            ]
                          },
                          {
                            "tag": "a",
                            "attrs": {
                              "href": "/help-en/10-analysis"
                            },
                            "children": [
                              {
                                "text": "10 Analysis"
                              }
                            ]
                          },
                          {
                            "tag": "a",
                            "attrs": {
                              "href": "/help-en/11-api"
                            },
                            "children": [
                              {
                                "text": "11 API"
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "article",
                    "attrs": {
                      "class": "role-card"
                    },
                    "children": [
                      {
                        "tag": "h3",
                        "attrs": {},
                        "children": [
                          {
                            "text": "Reviewer / manager"
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "Watches queues, decisions, blockers, risks, exceptions, operational readiness and understandable change impact."
                          }
                        ]
                      },
                      {
                        "tag": "div",
                        "attrs": {
                          "class": "role-links"
                        },
                        "children": [
                          {
                            "tag": "a",
                            "attrs": {
                              "href": "/help-en/03-cocpit"
                            },
                            "children": [
                              {
                                "text": "03 Cockpit"
                              }
                            ]
                          },
                          {
                            "tag": "a",
                            "attrs": {
                              "href": "/help-en/06-governance"
                            },
                            "children": [
                              {
                                "text": "06 Governance"
                              }
                            ]
                          },
                          {
                            "tag": "a",
                            "attrs": {
                              "href": "/help-en/10-analysis"
                            },
                            "children": [
                              {
                                "text": "10 Analysis"
                              }
                            ]
                          },
                          {
                            "tag": "a",
                            "attrs": {
                              "href": "/help-en/02-welcome"
                            },
                            "children": [
                              {
                                "text": "02 Overview"
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  }
                ]
              },
              {
                "text": "\n\n      "
              },
              {
                "tag": "h2",
                "attrs": {},
                "children": [
                  {
                    "text": "Manual chapters"
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "div",
                "attrs": {
                  "class": "manual-entry-grid"
                },
                "children": [
                  {
                    "tag": "a",
                    "attrs": {
                      "class": "manual-entry-card",
                      "href": "/help-en/01-install"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "01"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "Installation"
                                  }
                                ]
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "manual-entry-subtitle"
                                },
                                "children": [
                                  {
                                    "text": "01-install.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "The installer prepares the database, the first administrator account, enabled modules and optional seed or import data. It is the only part of the application available before normal sign-in, therefore it is protected by installation state and setup token."
                          }
                        ]
                      },
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-footer"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "open chapter"
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "a",
                    "attrs": {
                      "class": "manual-entry-card",
                      "href": "/help-en/02-welcome"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "02"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "Application purpose"
                                  }
                                ]
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "manual-entry-subtitle"
                                },
                                "children": [
                                  {
                                    "text": "02-welcome.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "S3C Manager is best used as a governance-first cockpit above services, capabilities, C3/FMN relations and readiness. It is not a ticketing system, monitoring platform, full CMDB or replacement for an Enterprise Architecture repository."
                          }
                        ]
                      },
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-footer"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "open chapter"
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "a",
                    "attrs": {
                      "class": "manual-entry-card",
                      "href": "/help-en/03-cocpit"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "03"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "Cockpit"
                                  }
                                ]
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "manual-entry-subtitle"
                                },
                                "children": [
                                  {
                                    "text": "03-cocpit.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "The cockpit is the fastest way to understand what needs attention. It combines service readiness, owned work, review queues, blockers, decisions and portfolio signals for each role."
                          }
                        ]
                      },
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-footer"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "open chapter"
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "a",
                    "attrs": {
                      "class": "manual-entry-card",
                      "href": "/help-en/04-services"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "04"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "Services"
                                  }
                                ]
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "manual-entry-subtitle"
                                },
                                "children": [
                                  {
                                    "text": "04-services.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "The service area is the core working space for service owners and catalogue administrators. It covers catalogue browsing, service list, service detail, graph view, editor, portfolio and new service intake."
                          }
                        ]
                      },
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-footer"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "open chapter"
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "a",
                    "attrs": {
                      "class": "manual-entry-card",
                      "href": "/help-en/05-capabilities_c3"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "05"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "Capabilities and C3"
                                  }
                                ]
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "manual-entry-subtitle"
                                },
                                "children": [
                                  {
                                    "text": "05-capabilities_c3.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "Capability and C3 views explain what a service supports and where architectural or operational gaps exist. They help architects and capability managers connect services to C3 capabilities, FMN spirals, applications, data objects and technology interactions."
                          }
                        ]
                      },
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-footer"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "open chapter"
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "a",
                    "attrs": {
                      "class": "manual-entry-card",
                      "href": "/help-en/06-governance"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "06"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "Governance"
                                  }
                                ]
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "manual-entry-subtitle"
                                },
                                "children": [
                                  {
                                    "text": "06-governance.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "Governance turns service catalogue evidence into auditable decisions. It covers readiness gates, review queues, decision records, exceptions, owner load and risk signals."
                          }
                        ]
                      },
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-footer"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "open chapter"
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "a",
                    "attrs": {
                      "class": "manual-entry-card",
                      "href": "/help-en/07-import"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "07"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "Import"
                                  }
                                ]
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "manual-entry-subtitle"
                                },
                                "children": [
                                  {
                                    "text": "07-import.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "Import brings service, reference, C3, FMN and integration evidence into the application. The safest workflow is profile selection, file upload, dry-run preview, issue review and then controlled execution."
                          }
                        ]
                      },
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-footer"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "open chapter"
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "a",
                    "attrs": {
                      "class": "manual-entry-card",
                      "href": "/help-en/08-admin"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "08"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "Administration"
                                  }
                                ]
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "manual-entry-subtitle"
                                },
                                "children": [
                                  {
                                    "text": "08-admin.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "Administration controls the safe operation of the instance: users, groups, roles, SSO, logs, reference data, import profiles, capability builder and installation diagnostics."
                          }
                        ]
                      },
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-footer"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "open chapter"
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "a",
                    "attrs": {
                      "class": "manual-entry-card",
                      "href": "/help-en/09-user"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "09"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "User"
                                  }
                                ]
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "manual-entry-subtitle"
                                },
                                "children": [
                                  {
                                    "text": "09-user.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "The user profile controls personal identity, language, password and role-visible work. It also explains why different users may see different navigation or actions."
                          }
                        ]
                      },
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-footer"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "open chapter"
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "a",
                    "attrs": {
                      "class": "manual-entry-card",
                      "href": "/help-en/10-analysis"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "10"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "Analysis"
                                  }
                                ]
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "manual-entry-subtitle"
                                },
                                "children": [
                                  {
                                    "text": "10-analysis.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "Analysis views help users answer what depends on what, where coverage is missing, which C3 items are affected and why a service is not ready."
                          }
                        ]
                      },
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-footer"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "open chapter"
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "a",
                    "attrs": {
                      "class": "manual-entry-card",
                      "href": "/help-en/11-api"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "11"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "API"
                                  }
                                ]
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "manual-entry-subtitle"
                                },
                                "children": [
                                  {
                                    "text": "11-api.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "The API lets other tools read catalogue, service, C3, governance and import context. It should be used with RBAC, authenticated sessions and clear ownership of integrations."
                          }
                        ]
                      },
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-footer"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "open chapter"
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "a",
                    "attrs": {
                      "class": "manual-entry-card",
                      "href": "/help-en/12-abbrevations"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "12"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "Abbreviations"
                                  }
                                ]
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "manual-entry-subtitle"
                                },
                                "children": [
                                  {
                                    "text": "12-abbrevations.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "This chapter explains frequent terms used in S3C Manager, ITIL, TOGAF, C3, FMN, APIs and workflow states. It helps managers, administrators and architects use the same vocabulary."
                          }
                        ]
                      },
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-footer"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "open chapter"
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  }
                ]
              },
              {
                "text": "\n\n      "
              },
              {
                "tag": "h2",
                "attrs": {},
                "children": [
                  {
                    "text": "Screenshot rule"
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "p",
                "attrs": {},
                "children": [
                  {
                    "text": "Screenshot slots use file names in the form img/"
                  },
                  {
                    "tag": "name",
                    "attrs": {},
                    "children": [
                      {
                        "text": ".png. After a UI change, place the current screenshot into docs/help-en/img or frontend/public/help-en/img and keep the caption name stable. The written explanation can stay manually maintained."
                      }
                    ]
                  }
                ]
              },
              {
                "text": "\n\n      "
              },
              {
                "tag": "figure",
                "attrs": {
                  "class": "screen-slot"
                },
                "children": [
                  {
                    "tag": "div",
                    "attrs": {},
                    "children": [
                      {
                        "text": "Screenshot: help index or main application"
                      },
                      {
                        "tag": "br",
                        "attrs": {}
                      },
                      {
                        "tag": "code",
                        "attrs": {},
                        "children": [
                          {
                            "text": "/img/help-en/help-index.png"
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "figcaption",
                    "attrs": {},
                    "children": [
                      {
                        "text": "Place a current screenshot of the help index or S3C Manager cockpit here."
                      }
                    ]
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "div",
                "attrs": {
                  "class": "chapter-nav"
                },
                "children": [
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "span",
                    "attrs": {}
                  },
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "a",
                    "attrs": {
                      "href": "/help-en/01-install"
                    },
                    "children": [
                      {
                        "text": "Next: Installation"
                      }
                    ]
                  },
                  {
                    "text": "\n      "
                  }
                ]
              },
              {
                "text": "\n    "
              }
            ]
          },
          {
            "text": "\n  "
          }
        ]
      },
      {
        "text": "\n  \n"
      }
    ]
  },
  {
    "key": "01-install",
    "fileName": "01-install.html",
    "route": "/help-en/01-install",
    "locale": "en",
    "title": "Installation, first-run wizard and operational prerequisites - S3C Manager Help",
    "body": [
      {
        "text": "\n  "
      },
      {
        "tag": "header",
        "attrs": {
          "class": "site-header"
        },
        "children": [
          {
            "text": "\n    "
          },
          {
            "tag": "a",
            "attrs": {
              "class": "back-to-app",
              "href": "/",
              "aria-label": "Back to application"
            },
            "children": [
              {
                "text": "← Back to application"
              }
            ]
          },
          {
            "text": "\n    "
          },
          {
            "tag": "button",
            "attrs": {
              "class": "hamburger",
              "type": "button",
              "aria-label": "Show menu"
            },
            "children": [
              {
                "text": "☰"
              }
            ]
          },
          {
            "text": "\n    "
          },
          {
            "tag": "a",
            "attrs": {
              "class": "logo",
              "href": "/help-en"
            },
            "children": [
              {
                "text": "S3C Manager"
              },
              {
                "tag": "span",
                "attrs": {},
                "children": [
                  {
                    "text": "Help manual"
                  }
                ]
              }
            ]
          },
          {
            "text": "\n    "
          },
          {
            "tag": "div",
            "attrs": {
              "class": "header-meta"
            },
            "children": [
              {
                "text": "01 · Installation"
              }
            ]
          },
          {
            "text": "\n  "
          }
        ]
      },
      {
        "text": "\n  "
      },
      {
        "tag": "div",
        "attrs": {
          "class": "layout"
        },
        "children": [
          {
            "text": "\n\n    "
          },
          {
            "tag": "nav",
            "attrs": {
              "class": "sidebar",
              "id": "sidebar",
              "aria-label": "Help chapters"
            },
            "children": [
              {
                "text": "\n      "
              },
              {
                "tag": "section",
                "attrs": {
                  "class": "sidebar-section",
                  "aria-expanded": "true"
                },
                "children": [
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "button",
                    "attrs": {
                      "class": "sidebar-section-toggle",
                      "type": "button"
                    },
                    "children": [
                      {
                        "text": "Help chapters "
                      },
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "chevron"
                        },
                        "children": [
                          {
                            "text": "▾"
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "div",
                    "attrs": {
                      "class": "sidebar-section-panel"
                    },
                    "children": [
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "00"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Index"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "index.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link active",
                          "href": "/help-en/01-install"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "01"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Installation"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "01-install.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/02-welcome"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "02"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Application purpose"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "02-welcome.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/03-cocpit"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "03"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Cockpit"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "03-cocpit.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/04-services"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "04"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Services"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "04-services.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/05-capabilities_c3"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "05"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Capabilities and C3"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "05-capabilities_c3.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/06-governance"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "06"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Governance"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "06-governance.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/07-import"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "07"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Import"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "07-import.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/08-admin"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "08"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Administration"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "08-admin.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/09-user"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "09"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "User"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "09-user.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/10-analysis"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "10"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Analysis"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "10-analysis.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/11-api"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "11"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "API"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "11-api.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/12-abbrevations"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "12"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Abbreviations"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "12-abbrevations.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n        "
                      }
                    ]
                  },
                  {
                    "text": "\n      "
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "div",
                "attrs": {
                  "class": "sidebar-footer"
                },
                "children": [
                  {
                    "text": "The structure is manually maintained. Screenshots belong in "
                  },
                  {
                    "tag": "code",
                    "attrs": {},
                    "children": [
                      {
                        "text": "docs/help-en/img"
                      }
                    ]
                  },
                  {
                    "text": "."
                  }
                ]
              },
              {
                "text": "\n    "
              }
            ]
          },
          {
            "text": "\n    "
          },
          {
            "tag": "main",
            "attrs": {
              "class": "content"
            },
            "children": [
              {
                "text": "\n      "
              },
              {
                "tag": "section",
                "attrs": {
                  "class": "page-hero"
                },
                "children": [
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "p",
                    "attrs": {
                      "class": "chapter-kicker"
                    },
                    "children": [
                      {
                        "text": "01 Installation"
                      }
                    ]
                  },
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "h1",
                    "attrs": {},
                    "children": [
                      {
                        "text": "Installation, first-run wizard and operational prerequisites"
                      }
                    ]
                  },
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "p",
                    "attrs": {
                      "class": "lead"
                    },
                    "children": [
                      {
                        "text": "The installer prepares the database, the first administrator account, enabled modules and optional seed or import data. It is the only part of the application available before normal sign-in, therefore it is protected by installation state and setup token."
                      }
                    ]
                  },
                  {
                    "text": "\n      "
                  }
                ]
              },
              {
                "text": "\n\n      "
              },
              {
                "tag": "h2",
                "attrs": {},
                "children": [
                  {
                    "text": "Why the installer matters"
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "p",
                "attrs": {},
                "children": [
                  {
                    "text": "In an enterprise tool, installation is not just a technical form. It defines instance identity, security posture, database connectivity, first accountable administrator and enabled modules. From an ITIL perspective it moves the deployment into a ready-for-operation state. From a governance perspective it creates the first auditable base for service, capability and C3 management."
                  }
                ]
              },
              {
                "text": "\n\n      "
              },
              {
                "tag": "h2",
                "attrs": {},
                "children": [
                  {
                    "text": "Environment requirements"
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "table",
                "attrs": {
                  "class": "field-table"
                },
                "children": [
                  {
                    "tag": "thead",
                    "attrs": {},
                    "children": [
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "th",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Area"
                              }
                            ]
                          },
                          {
                            "tag": "th",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Minimum"
                              }
                            ]
                          },
                          {
                            "tag": "th",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Recommended"
                              }
                            ]
                          },
                          {
                            "tag": "th",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Why it matters"
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "tbody",
                    "attrs": {},
                    "children": [
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "CPU"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "2 vCPU"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "4 vCPU"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Frontend, middleware, PostgreSQL, imports and graphs can run at the same time."
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "RAM"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "4 GB"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "8 GB or more"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "PostgreSQL, Next.js runtime and import dry-runs need memory for larger files."
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Disk"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "10 GB"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "20 GB plus backup space"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Database, uploads, exports, logs and backups need persistent storage."
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Docker"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Docker Engine 24+, Compose v2.20+"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Current stable version"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Standard local and production runtime."
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Secrets"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "JWT secret and DB password"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "File secrets or vault"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Authentication and database access must not depend on committed source files."
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  }
                ]
              },
              {
                "text": "\n\n      "
              },
              {
                "tag": "h2",
                "attrs": {},
                "children": [
                  {
                    "text": "The 12 installer screens"
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "p",
                "attrs": {},
                "children": [
                  {
                    "text": "The wizard starts with an application description and CZE/ENG language selection, then checks instance state and setup token, stores instance configuration, verifies secrets and database connectivity, creates the first admin, enables modules, plans data, previews imports, executes installation and shows the final summary."
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "div",
                "attrs": {
                  "class": "manual-entry-grid"
                },
                "children": [
                  {
                    "tag": "article",
                    "attrs": {
                      "class": "manual-entry-card"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "•"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "01 Welcome"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "Application purpose and language choice."
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "article",
                    "attrs": {
                      "class": "manual-entry-card"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "•"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "02 Setup token"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "Instance state, setup token and install start."
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "article",
                    "attrs": {
                      "class": "manual-entry-card"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "•"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "03 Configuration"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "Name, public URL, timezone, storage path and HTTPS mode."
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "article",
                    "attrs": {
                      "class": "manual-entry-card"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "•"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "04 Secrets"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "JWT, DB credentials and safe secret handling checklist."
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "article",
                    "attrs": {
                      "class": "manual-entry-card"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "•"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "05 Admin"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "First local administrator and password rules."
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "article",
                    "attrs": {
                      "class": "manual-entry-card"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "•"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "06 Connectivity"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "PostgreSQL and schema readiness."
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "article",
                    "attrs": {
                      "class": "manual-entry-card"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "•"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "07 Modules"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "Service Catalogue Core and optional C3 Taxonomy."
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "article",
                    "attrs": {
                      "class": "manual-entry-card"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "•"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "08 Data plan"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "Reference data, business data and demo data choices."
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "article",
                    "attrs": {
                      "class": "manual-entry-card"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "•"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "09 Upload"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "Initial CSV, XLSX or JSON files."
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "article",
                    "attrs": {
                      "class": "manual-entry-card"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "•"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "10 Preview"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "Column, row, error and warning preview."
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "article",
                    "attrs": {
                      "class": "manual-entry-card"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "•"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "11 Execute"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "Final install, seed, import and execution log."
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "article",
                    "attrs": {
                      "class": "manual-entry-card"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "•"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "12 Summary"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "Result, version, schema, modules and import statistics."
                          }
                        ]
                      }
                    ]
                  }
                ]
              },
              {
                "text": "\n\n      "
              },
              {
                "tag": "h2",
                "attrs": {},
                "children": [
                  {
                    "text": "Key fields and choices"
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "table",
                "attrs": {
                  "class": "field-table"
                },
                "children": [
                  {
                    "tag": "thead",
                    "attrs": {},
                    "children": [
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "th",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Field / choice"
                              }
                            ]
                          },
                          {
                            "tag": "th",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Meaning"
                              }
                            ]
                          },
                          {
                            "tag": "th",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Validation"
                              }
                            ]
                          },
                          {
                            "tag": "th",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Impact"
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "tbody",
                    "attrs": {},
                    "children": [
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Application environment"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "CZE or ENG environment."
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Only cs and en are accepted."
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Sets the installer language and default locale cookie."
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Setup token"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Secret token for write steps before login."
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Must match server configuration."
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Without it the instance cannot be bootstrapped safely."
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Base URL"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Public URL used by real users."
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Should match the production reverse proxy URL."
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Affects links, SSO callbacks, personal queues and exports."
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Storage path"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Writable path inside the app runtime."
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Must exist and be mounted."
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Used by uploads, imports, exports and future attachments."
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "First admin"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Root local administrator account."
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Requires strong password and unique username."
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Starts RBAC and administration ownership."
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  }
                ]
              },
              {
                "text": "\n\n      "
              },
              {
                "tag": "h2",
                "attrs": {},
                "children": [
                  {
                    "text": "Administrator panel after deployment"
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "p",
                "attrs": {},
                "children": [
                  {
                    "text": "After installation, administrators use Administration / Installation for readiness checks, schema information, repair signals, module state and operational diagnostics. It is not a second installer; it is a safe operational view of the installed instance."
                  }
                ]
              },
              {
                "text": "\n\n      "
              },
              {
                "tag": "figure",
                "attrs": {
                  "class": "screen-slot"
                },
                "children": [
                  {
                    "tag": "div",
                    "attrs": {},
                    "children": [
                      {
                        "text": "Screenshot: Installation"
                      },
                      {
                        "tag": "br",
                        "attrs": {}
                      },
                      {
                        "tag": "code",
                        "attrs": {},
                        "children": [
                          {
                            "text": "/img/help-en/01-install.png"
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "figcaption",
                    "attrs": {},
                    "children": [
                      {
                        "text": "Use this slot for the current UI screenshot related to this chapter."
                      }
                    ]
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "div",
                "attrs": {
                  "class": "chapter-nav"
                },
                "children": [
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "a",
                    "attrs": {
                      "href": "/help-en"
                    },
                    "children": [
                      {
                        "text": "Previous: Index"
                      }
                    ]
                  },
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "a",
                    "attrs": {
                      "href": "/help-en/02-welcome"
                    },
                    "children": [
                      {
                        "text": "Next: Application purpose"
                      }
                    ]
                  },
                  {
                    "text": "\n      "
                  }
                ]
              },
              {
                "text": "\n    "
              }
            ]
          },
          {
            "text": "\n  "
          }
        ]
      },
      {
        "text": "\n  \n"
      }
    ]
  },
  {
    "key": "02-welcome",
    "fileName": "02-welcome.html",
    "route": "/help-en/02-welcome",
    "locale": "en",
    "title": "What S3C Manager is and where it fits in enterprise governance - S3C Manager Help",
    "body": [
      {
        "text": "\n  "
      },
      {
        "tag": "header",
        "attrs": {
          "class": "site-header"
        },
        "children": [
          {
            "text": "\n    "
          },
          {
            "tag": "a",
            "attrs": {
              "class": "back-to-app",
              "href": "/",
              "aria-label": "Back to application"
            },
            "children": [
              {
                "text": "← Back to application"
              }
            ]
          },
          {
            "text": "\n    "
          },
          {
            "tag": "button",
            "attrs": {
              "class": "hamburger",
              "type": "button",
              "aria-label": "Show menu"
            },
            "children": [
              {
                "text": "☰"
              }
            ]
          },
          {
            "text": "\n    "
          },
          {
            "tag": "a",
            "attrs": {
              "class": "logo",
              "href": "/help-en"
            },
            "children": [
              {
                "text": "S3C Manager"
              },
              {
                "tag": "span",
                "attrs": {},
                "children": [
                  {
                    "text": "Help manual"
                  }
                ]
              }
            ]
          },
          {
            "text": "\n    "
          },
          {
            "tag": "div",
            "attrs": {
              "class": "header-meta"
            },
            "children": [
              {
                "text": "02 · Application purpose"
              }
            ]
          },
          {
            "text": "\n  "
          }
        ]
      },
      {
        "text": "\n  "
      },
      {
        "tag": "div",
        "attrs": {
          "class": "layout"
        },
        "children": [
          {
            "text": "\n\n    "
          },
          {
            "tag": "nav",
            "attrs": {
              "class": "sidebar",
              "id": "sidebar",
              "aria-label": "Help chapters"
            },
            "children": [
              {
                "text": "\n      "
              },
              {
                "tag": "section",
                "attrs": {
                  "class": "sidebar-section",
                  "aria-expanded": "true"
                },
                "children": [
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "button",
                    "attrs": {
                      "class": "sidebar-section-toggle",
                      "type": "button"
                    },
                    "children": [
                      {
                        "text": "Help chapters "
                      },
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "chevron"
                        },
                        "children": [
                          {
                            "text": "▾"
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "div",
                    "attrs": {
                      "class": "sidebar-section-panel"
                    },
                    "children": [
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "00"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Index"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "index.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/01-install"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "01"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Installation"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "01-install.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link active",
                          "href": "/help-en/02-welcome"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "02"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Application purpose"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "02-welcome.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/03-cocpit"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "03"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Cockpit"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "03-cocpit.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/04-services"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "04"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Services"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "04-services.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/05-capabilities_c3"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "05"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Capabilities and C3"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "05-capabilities_c3.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/06-governance"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "06"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Governance"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "06-governance.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/07-import"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "07"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Import"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "07-import.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/08-admin"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "08"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Administration"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "08-admin.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/09-user"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "09"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "User"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "09-user.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/10-analysis"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "10"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Analysis"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "10-analysis.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/11-api"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "11"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "API"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "11-api.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/12-abbrevations"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "12"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Abbreviations"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "12-abbrevations.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n        "
                      }
                    ]
                  },
                  {
                    "text": "\n      "
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "div",
                "attrs": {
                  "class": "sidebar-footer"
                },
                "children": [
                  {
                    "text": "The structure is manually maintained. Screenshots belong in "
                  },
                  {
                    "tag": "code",
                    "attrs": {},
                    "children": [
                      {
                        "text": "docs/help-en/img"
                      }
                    ]
                  },
                  {
                    "text": "."
                  }
                ]
              },
              {
                "text": "\n    "
              }
            ]
          },
          {
            "text": "\n    "
          },
          {
            "tag": "main",
            "attrs": {
              "class": "content"
            },
            "children": [
              {
                "text": "\n      "
              },
              {
                "tag": "section",
                "attrs": {
                  "class": "page-hero"
                },
                "children": [
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "p",
                    "attrs": {
                      "class": "chapter-kicker"
                    },
                    "children": [
                      {
                        "text": "02 Application overview"
                      }
                    ]
                  },
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "h1",
                    "attrs": {},
                    "children": [
                      {
                        "text": "What S3C Manager is and where it fits in enterprise governance"
                      }
                    ]
                  },
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "p",
                    "attrs": {
                      "class": "lead"
                    },
                    "children": [
                      {
                        "text": "S3C Manager is best used as a governance-first cockpit above services, capabilities, C3/FMN relations and readiness. It is not a ticketing system, monitoring platform, full CMDB or replacement for an Enterprise Architecture repository."
                      }
                    ]
                  },
                  {
                    "text": "\n      "
                  }
                ]
              },
              {
                "text": "\n\n      "
              },
              {
                "tag": "h2",
                "attrs": {},
                "children": [
                  {
                    "text": "Short definition"
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "p",
                "attrs": {},
                "children": [
                  {
                    "text": "The application answers practical portfolio and governance questions: what services exist, who owns them, which capabilities and C3 elements they support, whether they are ready for publication or change, where coverage gaps exist and what will be affected by a change."
                  }
                ]
              },
              {
                "text": "\n\n      "
              },
              {
                "tag": "h2",
                "attrs": {},
                "children": [
                  {
                    "text": "What it is and what it is not"
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "div",
                "attrs": {
                  "class": "manual-entry-grid"
                },
                "children": [
                  {
                    "tag": "article",
                    "attrs": {
                      "class": "manual-entry-card"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "•"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "Governance cockpit"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "Decision, readiness, ownership, exception and review context in one place."
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "article",
                    "attrs": {
                      "class": "manual-entry-card"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "•"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "Service catalogue"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "A managed catalogue of services, offerings, owners, lifecycle state and consumer-facing context."
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "article",
                    "attrs": {
                      "class": "manual-entry-card"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "•"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "Capability and C3/FMN cockpit"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "Mapping between services, business capabilities, C3 capabilities, spirals, applications and data objects."
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "article",
                    "attrs": {
                      "class": "manual-entry-card"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "•"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "Not ticketing or monitoring"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "It references operational readiness and decisions, but does not replace incident queues or live telemetry."
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "article",
                    "attrs": {
                      "class": "manual-entry-card"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "•"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "Not a full CMDB"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "It keeps service-relevant dependencies and ownership, not every infrastructure configuration item."
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "article",
                    "attrs": {
                      "class": "manual-entry-card"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "•"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "Not an EA repository"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "It supports architecture mapping without becoming a full ArchiMate modelling repository."
                          }
                        ]
                      }
                    ]
                  }
                ]
              },
              {
                "text": "\n\n      "
              },
              {
                "tag": "h2",
                "attrs": {},
                "children": [
                  {
                    "text": "Best use"
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "p",
                "attrs": {},
                "children": [
                  {
                    "text": "Use S3C Manager when an organization needs a shared decision surface between service management, architecture, ITSM and project delivery. It is especially useful before service publication, during portfolio review, while resolving capability gaps, and before change or release decisions."
                  }
                ]
              },
              {
                "text": "\n\n      "
              },
              {
                "tag": "h2",
                "attrs": {},
                "children": [
                  {
                    "text": "Process place in the organization"
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "div",
                "attrs": {
                  "class": "manual-entry-grid"
                },
                "children": [
                  {
                    "tag": "article",
                    "attrs": {
                      "class": "manual-entry-card"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "•"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "Service intake / demand"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "Capture a new service or change request with owner, purpose, lifecycle and initial capability context."
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "article",
                    "attrs": {
                      "class": "manual-entry-card"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "•"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "Service portfolio management"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "Classify services by portfolio, lifecycle, criticality, duplication and risk."
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "article",
                    "attrs": {
                      "class": "manual-entry-card"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "•"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "Architecture and capability mapping"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "Map services to capabilities, C3 elements, applications, data objects and integrations."
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "article",
                    "attrs": {
                      "class": "manual-entry-card"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "•"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "Service design"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "Complete offering, SLA, support model, dependencies, reviewers and security attributes."
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "article",
                    "attrs": {
                      "class": "manual-entry-card"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "•"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "Readiness gate"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "Check whether the service can be published, changed or retired."
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "article",
                    "attrs": {
                      "class": "manual-entry-card"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "•"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "Governance review"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "Approve, reject, defer or record an exception as an auditable decision."
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "article",
                    "attrs": {
                      "class": "manual-entry-card"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "•"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "Change / release / transition"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "Use impact analysis before changing a service, capability or C3 item."
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "article",
                    "attrs": {
                      "class": "manual-entry-card"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "•"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "Operate and improve"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "Track due reviews, warnings, governance queue, owner load, gaps and overlaps."
                          }
                        ]
                      }
                    ]
                  }
                ]
              },
              {
                "text": "\n\n      "
              },
              {
                "tag": "h2",
                "attrs": {},
                "children": [
                  {
                    "text": "When not to deploy it"
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "p",
                "attrs": {},
                "children": [
                  {
                    "text": "Do not use S3C Manager as the only tool for incident handling, monitoring, detailed asset discovery or complex enterprise modelling. In those cases it should integrate with the specialist system and keep only the governance and catalogue context."
                  }
                ]
              },
              {
                "text": "\n\n      "
              },
              {
                "tag": "figure",
                "attrs": {
                  "class": "screen-slot"
                },
                "children": [
                  {
                    "tag": "div",
                    "attrs": {},
                    "children": [
                      {
                        "text": "Screenshot: Application purpose"
                      },
                      {
                        "tag": "br",
                        "attrs": {}
                      },
                      {
                        "tag": "code",
                        "attrs": {},
                        "children": [
                          {
                            "text": "/img/help-en/02-welcome.png"
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "figcaption",
                    "attrs": {},
                    "children": [
                      {
                        "text": "Use this slot for the current UI screenshot related to this chapter."
                      }
                    ]
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "div",
                "attrs": {
                  "class": "chapter-nav"
                },
                "children": [
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "a",
                    "attrs": {
                      "href": "/help-en/01-install"
                    },
                    "children": [
                      {
                        "text": "Previous: Installation"
                      }
                    ]
                  },
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "a",
                    "attrs": {
                      "href": "/help-en/03-cocpit"
                    },
                    "children": [
                      {
                        "text": "Next: Cockpit"
                      }
                    ]
                  },
                  {
                    "text": "\n      "
                  }
                ]
              },
              {
                "text": "\n    "
              }
            ]
          },
          {
            "text": "\n  "
          }
        ]
      },
      {
        "text": "\n  \n"
      }
    ]
  },
  {
    "key": "03-cocpit",
    "fileName": "03-cocpit.html",
    "route": "/help-en/03-cocpit",
    "locale": "en",
    "title": "Main dashboard and personal work surface - S3C Manager Help",
    "body": [
      {
        "text": "\n  "
      },
      {
        "tag": "header",
        "attrs": {
          "class": "site-header"
        },
        "children": [
          {
            "text": "\n    "
          },
          {
            "tag": "a",
            "attrs": {
              "class": "back-to-app",
              "href": "/",
              "aria-label": "Back to application"
            },
            "children": [
              {
                "text": "← Back to application"
              }
            ]
          },
          {
            "text": "\n    "
          },
          {
            "tag": "button",
            "attrs": {
              "class": "hamburger",
              "type": "button",
              "aria-label": "Show menu"
            },
            "children": [
              {
                "text": "☰"
              }
            ]
          },
          {
            "text": "\n    "
          },
          {
            "tag": "a",
            "attrs": {
              "class": "logo",
              "href": "/help-en"
            },
            "children": [
              {
                "text": "S3C Manager"
              },
              {
                "tag": "span",
                "attrs": {},
                "children": [
                  {
                    "text": "Help manual"
                  }
                ]
              }
            ]
          },
          {
            "text": "\n    "
          },
          {
            "tag": "div",
            "attrs": {
              "class": "header-meta"
            },
            "children": [
              {
                "text": "03 · Cockpit"
              }
            ]
          },
          {
            "text": "\n  "
          }
        ]
      },
      {
        "text": "\n  "
      },
      {
        "tag": "div",
        "attrs": {
          "class": "layout"
        },
        "children": [
          {
            "text": "\n\n    "
          },
          {
            "tag": "nav",
            "attrs": {
              "class": "sidebar",
              "id": "sidebar",
              "aria-label": "Help chapters"
            },
            "children": [
              {
                "text": "\n      "
              },
              {
                "tag": "section",
                "attrs": {
                  "class": "sidebar-section",
                  "aria-expanded": "true"
                },
                "children": [
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "button",
                    "attrs": {
                      "class": "sidebar-section-toggle",
                      "type": "button"
                    },
                    "children": [
                      {
                        "text": "Help chapters "
                      },
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "chevron"
                        },
                        "children": [
                          {
                            "text": "▾"
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "div",
                    "attrs": {
                      "class": "sidebar-section-panel"
                    },
                    "children": [
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "00"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Index"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "index.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/01-install"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "01"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Installation"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "01-install.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/02-welcome"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "02"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Application purpose"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "02-welcome.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link active",
                          "href": "/help-en/03-cocpit"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "03"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Cockpit"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "03-cocpit.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/04-services"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "04"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Services"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "04-services.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/05-capabilities_c3"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "05"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Capabilities and C3"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "05-capabilities_c3.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/06-governance"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "06"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Governance"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "06-governance.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/07-import"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "07"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Import"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "07-import.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/08-admin"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "08"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Administration"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "08-admin.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/09-user"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "09"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "User"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "09-user.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/10-analysis"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "10"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Analysis"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "10-analysis.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/11-api"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "11"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "API"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "11-api.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/12-abbrevations"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "12"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Abbreviations"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "12-abbrevations.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n        "
                      }
                    ]
                  },
                  {
                    "text": "\n      "
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "div",
                "attrs": {
                  "class": "sidebar-footer"
                },
                "children": [
                  {
                    "text": "The structure is manually maintained. Screenshots belong in "
                  },
                  {
                    "tag": "code",
                    "attrs": {},
                    "children": [
                      {
                        "text": "docs/help-en/img"
                      }
                    ]
                  },
                  {
                    "text": "."
                  }
                ]
              },
              {
                "text": "\n    "
              }
            ]
          },
          {
            "text": "\n    "
          },
          {
            "tag": "main",
            "attrs": {
              "class": "content"
            },
            "children": [
              {
                "text": "\n      "
              },
              {
                "tag": "section",
                "attrs": {
                  "class": "page-hero"
                },
                "children": [
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "p",
                    "attrs": {
                      "class": "chapter-kicker"
                    },
                    "children": [
                      {
                        "text": "03 Cockpit"
                      }
                    ]
                  },
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "h1",
                    "attrs": {},
                    "children": [
                      {
                        "text": "Main dashboard and personal work surface"
                      }
                    ]
                  },
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "p",
                    "attrs": {
                      "class": "lead"
                    },
                    "children": [
                      {
                        "text": "The cockpit is the fastest way to understand what needs attention. It combines service readiness, owned work, review queues, blockers, decisions and portfolio signals for each role."
                      }
                    ]
                  },
                  {
                    "text": "\n      "
                  }
                ]
              },
              {
                "text": "\n\n      "
              },
              {
                "tag": "h2",
                "attrs": {},
                "children": [
                  {
                    "text": "Meaning of the cockpit view"
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "p",
                "attrs": {},
                "children": [
                  {
                    "text": "The cockpit turns catalogue data into operational decisions. It prevents users from opening many detail pages only to find missing owners, overdue reviews or blocked services."
                  }
                ]
              },
              {
                "text": "\n\n      "
              },
              {
                "tag": "h2",
                "attrs": {},
                "children": [
                  {
                    "text": "Main screens"
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "table",
                "attrs": {
                  "class": "field-table"
                },
                "children": [
                  {
                    "tag": "thead",
                    "attrs": {},
                    "children": [
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "th",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Route"
                              }
                            ]
                          },
                          {
                            "tag": "th",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Purpose"
                              }
                            ]
                          },
                          {
                            "tag": "th",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Typical user"
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "tbody",
                    "attrs": {},
                    "children": [
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "/"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Main governance overview with KPI cards and personal panels."
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Service owner, reviewer, manager"
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "/cockpit/my-tasks"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Personal queue with owned services, reviews, blockers and decisions."
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Logged-in user"
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "/operations"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Governance overview for readiness and risk."
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Reviewer, manager"
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  }
                ]
              },
              {
                "text": "\n\n      "
              },
              {
                "tag": "h2",
                "attrs": {},
                "children": [
                  {
                    "text": "Home cockpit blocks"
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "div",
                "attrs": {
                  "class": "manual-entry-grid"
                },
                "children": [
                  {
                    "tag": "article",
                    "attrs": {
                      "class": "manual-entry-card"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "•"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "Page header"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "Explains the current cockpit purpose and next actions."
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "article",
                    "attrs": {
                      "class": "manual-entry-card"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "•"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "KPI cards"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "Surface service count, readiness warnings, reviews due and other portfolio signals."
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "article",
                    "attrs": {
                      "class": "manual-entry-card"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "•"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "My owned services"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "Services where the current user is accountable."
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "article",
                    "attrs": {
                      "class": "manual-entry-card"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "•"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "My reviews"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "Open review request links assigned to the current user."
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "article",
                    "attrs": {
                      "class": "manual-entry-card"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "•"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "My blockers"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "Items that prevent publication, readiness or governance closure."
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "article",
                    "attrs": {
                      "class": "manual-entry-card"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "•"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "My decisions and blockers"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "Recent decisions and readiness blockers requiring attention."
                          }
                        ]
                      }
                    ]
                  }
                ]
              },
              {
                "text": "\n\n      "
              },
              {
                "tag": "h2",
                "attrs": {},
                "children": [
                  {
                    "text": "How to use it by role"
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "p",
                "attrs": {},
                "children": [
                  {
                    "text": "A service owner starts with owned services and readiness warnings. A reviewer opens reviews and decisions. A manager watches owner load, portfolio signals and blocked items. An architect follows capability gaps and service relations from cockpit signals into the graph or capability workspace."
                  }
                ]
              },
              {
                "text": "\n\n      "
              },
              {
                "tag": "h2",
                "attrs": {},
                "children": [
                  {
                    "text": "Common mistakes"
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "p",
                "attrs": {},
                "children": [
                  {
                    "text": "Do not treat cockpit warnings as final judgement. They are signals pointing to missing evidence or overdue work. Always open the service detail, readiness queue or decision record before changing lifecycle state."
                  }
                ]
              },
              {
                "text": "\n\n      "
              },
              {
                "tag": "figure",
                "attrs": {
                  "class": "screen-slot"
                },
                "children": [
                  {
                    "tag": "div",
                    "attrs": {},
                    "children": [
                      {
                        "text": "Screenshot: Cockpit"
                      },
                      {
                        "tag": "br",
                        "attrs": {}
                      },
                      {
                        "tag": "code",
                        "attrs": {},
                        "children": [
                          {
                            "text": "/img/help-en/03-cocpit.png"
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "figcaption",
                    "attrs": {},
                    "children": [
                      {
                        "text": "Use this slot for the current UI screenshot related to this chapter."
                      }
                    ]
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "div",
                "attrs": {
                  "class": "chapter-nav"
                },
                "children": [
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "a",
                    "attrs": {
                      "href": "/help-en/02-welcome"
                    },
                    "children": [
                      {
                        "text": "Previous: Application purpose"
                      }
                    ]
                  },
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "a",
                    "attrs": {
                      "href": "/help-en/04-services"
                    },
                    "children": [
                      {
                        "text": "Next: Services"
                      }
                    ]
                  },
                  {
                    "text": "\n      "
                  }
                ]
              },
              {
                "text": "\n    "
              }
            ]
          },
          {
            "text": "\n  "
          }
        ]
      },
      {
        "text": "\n  \n"
      }
    ]
  },
  {
    "key": "04-services",
    "fileName": "04-services.html",
    "route": "/help-en/04-services",
    "locale": "en",
    "title": "Service catalogue, Service 360 and service editor - S3C Manager Help",
    "body": [
      {
        "text": "\n  "
      },
      {
        "tag": "header",
        "attrs": {
          "class": "site-header"
        },
        "children": [
          {
            "text": "\n    "
          },
          {
            "tag": "a",
            "attrs": {
              "class": "back-to-app",
              "href": "/",
              "aria-label": "Back to application"
            },
            "children": [
              {
                "text": "← Back to application"
              }
            ]
          },
          {
            "text": "\n    "
          },
          {
            "tag": "button",
            "attrs": {
              "class": "hamburger",
              "type": "button",
              "aria-label": "Show menu"
            },
            "children": [
              {
                "text": "☰"
              }
            ]
          },
          {
            "text": "\n    "
          },
          {
            "tag": "a",
            "attrs": {
              "class": "logo",
              "href": "/help-en"
            },
            "children": [
              {
                "text": "S3C Manager"
              },
              {
                "tag": "span",
                "attrs": {},
                "children": [
                  {
                    "text": "Help manual"
                  }
                ]
              }
            ]
          },
          {
            "text": "\n    "
          },
          {
            "tag": "div",
            "attrs": {
              "class": "header-meta"
            },
            "children": [
              {
                "text": "04 · Services"
              }
            ]
          },
          {
            "text": "\n  "
          }
        ]
      },
      {
        "text": "\n  "
      },
      {
        "tag": "div",
        "attrs": {
          "class": "layout"
        },
        "children": [
          {
            "text": "\n\n    "
          },
          {
            "tag": "nav",
            "attrs": {
              "class": "sidebar",
              "id": "sidebar",
              "aria-label": "Help chapters"
            },
            "children": [
              {
                "text": "\n      "
              },
              {
                "tag": "section",
                "attrs": {
                  "class": "sidebar-section",
                  "aria-expanded": "true"
                },
                "children": [
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "button",
                    "attrs": {
                      "class": "sidebar-section-toggle",
                      "type": "button"
                    },
                    "children": [
                      {
                        "text": "Help chapters "
                      },
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "chevron"
                        },
                        "children": [
                          {
                            "text": "▾"
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "div",
                    "attrs": {
                      "class": "sidebar-section-panel"
                    },
                    "children": [
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "00"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Index"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "index.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/01-install"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "01"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Installation"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "01-install.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/02-welcome"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "02"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Application purpose"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "02-welcome.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/03-cocpit"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "03"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Cockpit"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "03-cocpit.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link active",
                          "href": "/help-en/04-services"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "04"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Services"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "04-services.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/05-capabilities_c3"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "05"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Capabilities and C3"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "05-capabilities_c3.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/06-governance"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "06"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Governance"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "06-governance.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/07-import"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "07"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Import"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "07-import.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/08-admin"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "08"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Administration"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "08-admin.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/09-user"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "09"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "User"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "09-user.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/10-analysis"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "10"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Analysis"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "10-analysis.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/11-api"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "11"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "API"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "11-api.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/12-abbrevations"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "12"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Abbreviations"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "12-abbrevations.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n        "
                      }
                    ]
                  },
                  {
                    "text": "\n      "
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "div",
                "attrs": {
                  "class": "sidebar-footer"
                },
                "children": [
                  {
                    "text": "The structure is manually maintained. Screenshots belong in "
                  },
                  {
                    "tag": "code",
                    "attrs": {},
                    "children": [
                      {
                        "text": "docs/help-en/img"
                      }
                    ]
                  },
                  {
                    "text": "."
                  }
                ]
              },
              {
                "text": "\n    "
              }
            ]
          },
          {
            "text": "\n    "
          },
          {
            "tag": "main",
            "attrs": {
              "class": "content"
            },
            "children": [
              {
                "text": "\n      "
              },
              {
                "tag": "section",
                "attrs": {
                  "class": "page-hero"
                },
                "children": [
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "p",
                    "attrs": {
                      "class": "chapter-kicker"
                    },
                    "children": [
                      {
                        "text": "04 Services"
                      }
                    ]
                  },
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "h1",
                    "attrs": {},
                    "children": [
                      {
                        "text": "Service catalogue, Service 360 and service editor"
                      }
                    ]
                  },
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "p",
                    "attrs": {
                      "class": "lead"
                    },
                    "children": [
                      {
                        "text": "The service area is the core working space for service owners and catalogue administrators. It covers catalogue browsing, service list, service detail, graph view, editor, portfolio and new service intake."
                      }
                    ]
                  },
                  {
                    "text": "\n      "
                  }
                ]
              },
              {
                "text": "\n\n      "
              },
              {
                "tag": "h2",
                "attrs": {},
                "children": [
                  {
                    "text": "Why the service catalogue matters"
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "p",
                "attrs": {},
                "children": [
                  {
                    "text": "A service is the main governance object. It connects consumer value, ownership, lifecycle, offering evidence, support model, dependencies, capability mapping and governance decisions."
                  }
                ]
              },
              {
                "text": "\n\n      "
              },
              {
                "tag": "h2",
                "attrs": {},
                "children": [
                  {
                    "text": "Main pages"
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "table",
                "attrs": {
                  "class": "field-table"
                },
                "children": [
                  {
                    "tag": "thead",
                    "attrs": {},
                    "children": [
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "th",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Page"
                              }
                            ]
                          },
                          {
                            "tag": "th",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Route"
                              }
                            ]
                          },
                          {
                            "tag": "th",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Purpose"
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "tbody",
                    "attrs": {},
                    "children": [
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Catalogue browse"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "/catalogue"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Business-friendly entry point for browsing service portfolios and audience views."
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Service list"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "/services/list"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Operational list with filters, search, columns and export."
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Service graph"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "/services/graph"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Visual relation map across services and dependencies."
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Service detail"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "/services/{id}"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Service 360 view for owners, support, request and governance context."
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Service detail graph"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "/services/{id}/graph"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Focused graph around one service and its dependencies."
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Service editor"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "/services/{id}/edit"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Controlled edit form for lifecycle, owner, offering, support and mappings."
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "New service wizard"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "/management/new-service"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Guided creation of a new catalogue service."
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  }
                ]
              },
              {
                "text": "\n\n      "
              },
              {
                "tag": "h2",
                "attrs": {},
                "children": [
                  {
                    "text": "Important editor areas"
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "div",
                "attrs": {
                  "class": "manual-entry-grid"
                },
                "children": [
                  {
                    "tag": "article",
                    "attrs": {
                      "class": "manual-entry-card"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "•"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "Service identity"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "Service ID, title, summary, portfolio, domain, audience and lifecycle state."
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "article",
                    "attrs": {
                      "class": "manual-entry-card"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "•"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "Publish gate"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "Rules that prevent publication when required evidence is missing."
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "article",
                    "attrs": {
                      "class": "manual-entry-card"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "•"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "Lifecycle rules"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "Controlled transitions such as draft, active, retiring and retired."
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "article",
                    "attrs": {
                      "class": "manual-entry-card"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "•"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "Offering evidence"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "Consumer-facing service offering, requestability, channel and value statement."
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "article",
                    "attrs": {
                      "class": "manual-entry-card"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "•"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "Relationships"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "Dependencies, replacements, related services and impact paths."
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "article",
                    "attrs": {
                      "class": "manual-entry-card"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "•"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "C3 mapping"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "Links from the service to capabilities, C3 services, applications and data objects."
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "article",
                    "attrs": {
                      "class": "manual-entry-card"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "•"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "Support model"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "Owner, reviewer, support contacts, SLA and operational links."
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "article",
                    "attrs": {
                      "class": "manual-entry-card"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "•"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "Audience policies"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "Who may request or consume the service and under what constraints."
                          }
                        ]
                      }
                    ]
                  }
                ]
              },
              {
                "text": "\n\n      "
              },
              {
                "tag": "h2",
                "attrs": {},
                "children": [
                  {
                    "text": "Readiness rules connected to a service"
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "p",
                "attrs": {},
                "children": [
                  {
                    "text": "Readiness warnings usually come from missing owner, missing summary, incomplete C3 mapping, missing offering evidence, missing review date, unclear dependency classification or absent exception. Fix the source field rather than hiding the warning."
                  }
                ]
              },
              {
                "text": "\n\n      "
              },
              {
                "tag": "h2",
                "attrs": {},
                "children": [
                  {
                    "text": "Typical scenarios"
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "div",
                "attrs": {
                  "class": "manual-entry-grid"
                },
                "children": [
                  {
                    "tag": "article",
                    "attrs": {
                      "class": "manual-entry-card"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "•"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "Create a service"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "Use the new service wizard, add owner and purpose, then complete mappings and readiness evidence."
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "article",
                    "attrs": {
                      "class": "manual-entry-card"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "•"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "Prepare for publication"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "Open readiness, resolve missing fields, request review and record the decision."
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "article",
                    "attrs": {
                      "class": "manual-entry-card"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "•"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "Assess change impact"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "Open the service graph and dependencies before editing relationships or lifecycle."
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "article",
                    "attrs": {
                      "class": "manual-entry-card"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "•"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "Retire a service"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "Check replacements, consumers, decisions and dependencies before moving to retired."
                          }
                        ]
                      }
                    ]
                  }
                ]
              },
              {
                "text": "\n\n      "
              },
              {
                "tag": "h2",
                "attrs": {},
                "children": [
                  {
                    "text": "Common mistakes"
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "p",
                "attrs": {},
                "children": [
                  {
                    "text": "Avoid using raw import evidence as the primary business description. Do not publish a service without owner, offering evidence and review context. Do not change dependencies without checking impact analysis."
                  }
                ]
              },
              {
                "text": "\n\n      "
              },
              {
                "tag": "figure",
                "attrs": {
                  "class": "screen-slot"
                },
                "children": [
                  {
                    "tag": "div",
                    "attrs": {},
                    "children": [
                      {
                        "text": "Screenshot: Services"
                      },
                      {
                        "tag": "br",
                        "attrs": {}
                      },
                      {
                        "tag": "code",
                        "attrs": {},
                        "children": [
                          {
                            "text": "/img/help-en/04-services.png"
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "figcaption",
                    "attrs": {},
                    "children": [
                      {
                        "text": "Use this slot for the current UI screenshot related to this chapter."
                      }
                    ]
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "div",
                "attrs": {
                  "class": "chapter-nav"
                },
                "children": [
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "a",
                    "attrs": {
                      "href": "/help-en/03-cocpit"
                    },
                    "children": [
                      {
                        "text": "Previous: Cockpit"
                      }
                    ]
                  },
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "a",
                    "attrs": {
                      "href": "/help-en/05-capabilities_c3"
                    },
                    "children": [
                      {
                        "text": "Next: Capabilities and C3"
                      }
                    ]
                  },
                  {
                    "text": "\n      "
                  }
                ]
              },
              {
                "text": "\n    "
              }
            ]
          },
          {
            "text": "\n  "
          }
        ]
      },
      {
        "text": "\n  \n"
      }
    ]
  },
  {
    "key": "05-capabilities_c3",
    "fileName": "05-capabilities_c3.html",
    "route": "/help-en/05-capabilities_c3",
    "locale": "en",
    "title": "Capability management, C3 taxonomy and FMN spirals - S3C Manager Help",
    "body": [
      {
        "text": "\n  "
      },
      {
        "tag": "header",
        "attrs": {
          "class": "site-header"
        },
        "children": [
          {
            "text": "\n    "
          },
          {
            "tag": "a",
            "attrs": {
              "class": "back-to-app",
              "href": "/",
              "aria-label": "Back to application"
            },
            "children": [
              {
                "text": "← Back to application"
              }
            ]
          },
          {
            "text": "\n    "
          },
          {
            "tag": "button",
            "attrs": {
              "class": "hamburger",
              "type": "button",
              "aria-label": "Show menu"
            },
            "children": [
              {
                "text": "☰"
              }
            ]
          },
          {
            "text": "\n    "
          },
          {
            "tag": "a",
            "attrs": {
              "class": "logo",
              "href": "/help-en"
            },
            "children": [
              {
                "text": "S3C Manager"
              },
              {
                "tag": "span",
                "attrs": {},
                "children": [
                  {
                    "text": "Help manual"
                  }
                ]
              }
            ]
          },
          {
            "text": "\n    "
          },
          {
            "tag": "div",
            "attrs": {
              "class": "header-meta"
            },
            "children": [
              {
                "text": "05 · Capabilities and C3"
              }
            ]
          },
          {
            "text": "\n  "
          }
        ]
      },
      {
        "text": "\n  "
      },
      {
        "tag": "div",
        "attrs": {
          "class": "layout"
        },
        "children": [
          {
            "text": "\n\n    "
          },
          {
            "tag": "nav",
            "attrs": {
              "class": "sidebar",
              "id": "sidebar",
              "aria-label": "Help chapters"
            },
            "children": [
              {
                "text": "\n      "
              },
              {
                "tag": "section",
                "attrs": {
                  "class": "sidebar-section",
                  "aria-expanded": "true"
                },
                "children": [
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "button",
                    "attrs": {
                      "class": "sidebar-section-toggle",
                      "type": "button"
                    },
                    "children": [
                      {
                        "text": "Help chapters "
                      },
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "chevron"
                        },
                        "children": [
                          {
                            "text": "▾"
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "div",
                    "attrs": {
                      "class": "sidebar-section-panel"
                    },
                    "children": [
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "00"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Index"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "index.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/01-install"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "01"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Installation"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "01-install.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/02-welcome"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "02"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Application purpose"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "02-welcome.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/03-cocpit"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "03"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Cockpit"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "03-cocpit.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/04-services"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "04"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Services"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "04-services.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link active",
                          "href": "/help-en/05-capabilities_c3"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "05"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Capabilities and C3"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "05-capabilities_c3.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/06-governance"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "06"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Governance"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "06-governance.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/07-import"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "07"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Import"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "07-import.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/08-admin"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "08"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Administration"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "08-admin.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/09-user"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "09"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "User"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "09-user.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/10-analysis"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "10"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Analysis"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "10-analysis.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/11-api"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "11"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "API"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "11-api.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/12-abbrevations"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "12"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Abbreviations"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "12-abbrevations.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n        "
                      }
                    ]
                  },
                  {
                    "text": "\n      "
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "div",
                "attrs": {
                  "class": "sidebar-footer"
                },
                "children": [
                  {
                    "text": "The structure is manually maintained. Screenshots belong in "
                  },
                  {
                    "tag": "code",
                    "attrs": {},
                    "children": [
                      {
                        "text": "docs/help-en/img"
                      }
                    ]
                  },
                  {
                    "text": "."
                  }
                ]
              },
              {
                "text": "\n    "
              }
            ]
          },
          {
            "text": "\n    "
          },
          {
            "tag": "main",
            "attrs": {
              "class": "content"
            },
            "children": [
              {
                "text": "\n      "
              },
              {
                "tag": "section",
                "attrs": {
                  "class": "page-hero"
                },
                "children": [
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "p",
                    "attrs": {
                      "class": "chapter-kicker"
                    },
                    "children": [
                      {
                        "text": "05 Capabilities and C3"
                      }
                    ]
                  },
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "h1",
                    "attrs": {},
                    "children": [
                      {
                        "text": "Capability management, C3 taxonomy and FMN spirals"
                      }
                    ]
                  },
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "p",
                    "attrs": {
                      "class": "lead"
                    },
                    "children": [
                      {
                        "text": "Capability and C3 views explain what a service supports and where architectural or operational gaps exist. They help architects and capability managers connect services to C3 capabilities, FMN spirals, applications, data objects and technology interactions."
                      }
                    ]
                  },
                  {
                    "text": "\n      "
                  }
                ]
              },
              {
                "text": "\n\n      "
              },
              {
                "tag": "h2",
                "attrs": {},
                "children": [
                  {
                    "text": "Mental model"
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "p",
                "attrs": {},
                "children": [
                  {
                    "text": "Capabilities describe what the organization needs to do. C3 taxonomy items provide structured command, control and communication context. Services provide concrete fulfilment. FMN spirals provide baseline grouping. The value comes from the relationships between these layers."
                  }
                ]
              },
              {
                "text": "\n\n      "
              },
              {
                "tag": "h2",
                "attrs": {},
                "children": [
                  {
                    "text": "Main pages"
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "table",
                "attrs": {
                  "class": "field-table"
                },
                "children": [
                  {
                    "tag": "thead",
                    "attrs": {},
                    "children": [
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "th",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Page"
                              }
                            ]
                          },
                          {
                            "tag": "th",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Route"
                              }
                            ]
                          },
                          {
                            "tag": "th",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Purpose"
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "tbody",
                    "attrs": {},
                    "children": [
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Capabilities workspace"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "/capabilities"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Overview of coverage, gaps and overlaps."
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Capability detail"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "/capabilities/{slug}"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Capability context, linked services and evidence."
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Capability maps"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "/c3/capability-map-spiral7 and related routes"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Visual map of C3 capabilities by baseline or spiral."
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Expert C3 reference"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "/c3/list"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Administrative list of C3 entities and taxonomy records."
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "C3 entity detail"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "/c3/{uuid}"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Read or edit detailed C3 entity evidence."
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Spirals"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "/spirals"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "FMN spiral and baseline overview."
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  }
                ]
              },
              {
                "text": "\n\n      "
              },
              {
                "tag": "h2",
                "attrs": {},
                "children": [
                  {
                    "text": "C3 entity workspace"
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "div",
                "attrs": {
                  "class": "manual-entry-grid"
                },
                "children": [
                  {
                    "tag": "article",
                    "attrs": {
                      "class": "manual-entry-card"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "•"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "Classification and hierarchy"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "Entity type, parent, level, spiral and taxonomy placement."
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "article",
                    "attrs": {
                      "class": "manual-entry-card"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "•"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "Identity"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "External ID, title, UUID and source identifiers."
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "article",
                    "attrs": {
                      "class": "manual-entry-card"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "•"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "Description"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "Human-readable explanation of purpose and scope."
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "article",
                    "attrs": {
                      "class": "manual-entry-card"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "•"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "Source and quality"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "Import provenance, modification date and evidence quality."
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "article",
                    "attrs": {
                      "class": "manual-entry-card"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "•"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "Links and completeness"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "Relations to services, applications, data objects and capabilities."
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "article",
                    "attrs": {
                      "class": "manual-entry-card"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "•"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "Raw JSON / code editor"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "Technical evidence preserved for expert admins and imports."
                          }
                        ]
                      }
                    ]
                  }
                ]
              },
              {
                "text": "\n\n      "
              },
              {
                "tag": "h2",
                "attrs": {},
                "children": [
                  {
                    "text": "How to create and link a capability"
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "p",
                "attrs": {},
                "children": [
                  {
                    "text": "Create or import the capability, verify hierarchy and external ID, map it to C3 and FMN context, link services that fulfil it, then review coverage gaps and overlaps. The final step is a governance decision or readiness action when a gap materially affects a service."
                  }
                ]
              },
              {
                "text": "\n\n      "
              },
              {
                "tag": "h2",
                "attrs": {},
                "children": [
                  {
                    "text": "Governance impact"
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "p",
                "attrs": {},
                "children": [
                  {
                    "text": "Missing capability mapping can block publication, lower readiness score or trigger architecture review. A capability gap is not automatically a failure, but it must be understood and either resolved or accepted as a documented decision."
                  }
                ]
              },
              {
                "text": "\n\n      "
              },
              {
                "tag": "figure",
                "attrs": {
                  "class": "screen-slot"
                },
                "children": [
                  {
                    "tag": "div",
                    "attrs": {},
                    "children": [
                      {
                        "text": "Screenshot: Capabilities and C3"
                      },
                      {
                        "tag": "br",
                        "attrs": {}
                      },
                      {
                        "tag": "code",
                        "attrs": {},
                        "children": [
                          {
                            "text": "/img/help-en/05-capabilities_c3.png"
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "figcaption",
                    "attrs": {},
                    "children": [
                      {
                        "text": "Use this slot for the current UI screenshot related to this chapter."
                      }
                    ]
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "div",
                "attrs": {
                  "class": "chapter-nav"
                },
                "children": [
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "a",
                    "attrs": {
                      "href": "/help-en/04-services"
                    },
                    "children": [
                      {
                        "text": "Previous: Services"
                      }
                    ]
                  },
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "a",
                    "attrs": {
                      "href": "/help-en/06-governance"
                    },
                    "children": [
                      {
                        "text": "Next: Governance"
                      }
                    ]
                  },
                  {
                    "text": "\n      "
                  }
                ]
              },
              {
                "text": "\n    "
              }
            ]
          },
          {
            "text": "\n  "
          }
        ]
      },
      {
        "text": "\n  \n"
      }
    ]
  },
  {
    "key": "06-governance",
    "fileName": "06-governance.html",
    "route": "/help-en/06-governance",
    "locale": "en",
    "title": "Operations cockpit, readiness, reviews and decisions - S3C Manager Help",
    "body": [
      {
        "text": "\n  "
      },
      {
        "tag": "header",
        "attrs": {
          "class": "site-header"
        },
        "children": [
          {
            "text": "\n    "
          },
          {
            "tag": "a",
            "attrs": {
              "class": "back-to-app",
              "href": "/",
              "aria-label": "Back to application"
            },
            "children": [
              {
                "text": "← Back to application"
              }
            ]
          },
          {
            "text": "\n    "
          },
          {
            "tag": "button",
            "attrs": {
              "class": "hamburger",
              "type": "button",
              "aria-label": "Show menu"
            },
            "children": [
              {
                "text": "☰"
              }
            ]
          },
          {
            "text": "\n    "
          },
          {
            "tag": "a",
            "attrs": {
              "class": "logo",
              "href": "/help-en"
            },
            "children": [
              {
                "text": "S3C Manager"
              },
              {
                "tag": "span",
                "attrs": {},
                "children": [
                  {
                    "text": "Help manual"
                  }
                ]
              }
            ]
          },
          {
            "text": "\n    "
          },
          {
            "tag": "div",
            "attrs": {
              "class": "header-meta"
            },
            "children": [
              {
                "text": "06 · Governance"
              }
            ]
          },
          {
            "text": "\n  "
          }
        ]
      },
      {
        "text": "\n  "
      },
      {
        "tag": "div",
        "attrs": {
          "class": "layout"
        },
        "children": [
          {
            "text": "\n\n    "
          },
          {
            "tag": "nav",
            "attrs": {
              "class": "sidebar",
              "id": "sidebar",
              "aria-label": "Help chapters"
            },
            "children": [
              {
                "text": "\n      "
              },
              {
                "tag": "section",
                "attrs": {
                  "class": "sidebar-section",
                  "aria-expanded": "true"
                },
                "children": [
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "button",
                    "attrs": {
                      "class": "sidebar-section-toggle",
                      "type": "button"
                    },
                    "children": [
                      {
                        "text": "Help chapters "
                      },
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "chevron"
                        },
                        "children": [
                          {
                            "text": "▾"
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "div",
                    "attrs": {
                      "class": "sidebar-section-panel"
                    },
                    "children": [
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "00"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Index"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "index.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/01-install"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "01"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Installation"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "01-install.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/02-welcome"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "02"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Application purpose"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "02-welcome.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/03-cocpit"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "03"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Cockpit"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "03-cocpit.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/04-services"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "04"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Services"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "04-services.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/05-capabilities_c3"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "05"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Capabilities and C3"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "05-capabilities_c3.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link active",
                          "href": "/help-en/06-governance"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "06"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Governance"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "06-governance.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/07-import"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "07"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Import"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "07-import.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/08-admin"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "08"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Administration"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "08-admin.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/09-user"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "09"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "User"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "09-user.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/10-analysis"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "10"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Analysis"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "10-analysis.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/11-api"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "11"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "API"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "11-api.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/12-abbrevations"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "12"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Abbreviations"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "12-abbrevations.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n        "
                      }
                    ]
                  },
                  {
                    "text": "\n      "
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "div",
                "attrs": {
                  "class": "sidebar-footer"
                },
                "children": [
                  {
                    "text": "The structure is manually maintained. Screenshots belong in "
                  },
                  {
                    "tag": "code",
                    "attrs": {},
                    "children": [
                      {
                        "text": "docs/help-en/img"
                      }
                    ]
                  },
                  {
                    "text": "."
                  }
                ]
              },
              {
                "text": "\n    "
              }
            ]
          },
          {
            "text": "\n    "
          },
          {
            "tag": "main",
            "attrs": {
              "class": "content"
            },
            "children": [
              {
                "text": "\n      "
              },
              {
                "tag": "section",
                "attrs": {
                  "class": "page-hero"
                },
                "children": [
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "p",
                    "attrs": {
                      "class": "chapter-kicker"
                    },
                    "children": [
                      {
                        "text": "06 Governance"
                      }
                    ]
                  },
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "h1",
                    "attrs": {},
                    "children": [
                      {
                        "text": "Operations cockpit, readiness, reviews and decisions"
                      }
                    ]
                  },
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "p",
                    "attrs": {
                      "class": "lead"
                    },
                    "children": [
                      {
                        "text": "Governance turns service catalogue evidence into auditable decisions. It covers readiness gates, review queues, decision records, exceptions, owner load and risk signals."
                      }
                    ]
                  },
                  {
                    "text": "\n      "
                  }
                ]
              },
              {
                "text": "\n\n      "
              },
              {
                "tag": "h2",
                "attrs": {},
                "children": [
                  {
                    "text": "Governance meaning"
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "p",
                "attrs": {},
                "children": [
                  {
                    "text": "The application does not only store services. It helps decide whether a service is ready to publish, change, operate or retire. The governance layer preserves why a decision was made and what evidence existed at that time."
                  }
                ]
              },
              {
                "text": "\n\n      "
              },
              {
                "tag": "h2",
                "attrs": {},
                "children": [
                  {
                    "text": "Route map"
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "table",
                "attrs": {
                  "class": "field-table"
                },
                "children": [
                  {
                    "tag": "thead",
                    "attrs": {},
                    "children": [
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "th",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Route"
                              }
                            ]
                          },
                          {
                            "tag": "th",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Purpose"
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "tbody",
                    "attrs": {},
                    "children": [
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "/operations"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Operations cockpit with readiness and risk overview."
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "/operations/readiness"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Readiness queue for services that need attention."
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "/operations/reviews"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Governance review queue."
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "/operations/decisions"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Decision log and exception history."
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "/operations/owner-load"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Owner workload and responsibility distribution."
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  }
                ]
              },
              {
                "text": "\n\n      "
              },
              {
                "tag": "h2",
                "attrs": {},
                "children": [
                  {
                    "text": "Readiness rules"
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "div",
                "attrs": {
                  "class": "manual-entry-grid"
                },
                "children": [
                  {
                    "tag": "article",
                    "attrs": {
                      "class": "manual-entry-card"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "•"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "Owner missing"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "Every published or reviewed service needs a responsible owner."
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "article",
                    "attrs": {
                      "class": "manual-entry-card"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "•"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "Offering evidence missing"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "Users must understand what can be requested or consumed."
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "article",
                    "attrs": {
                      "class": "manual-entry-card"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "•"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "C3 mapping missing"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "Architecture and capability impact cannot be assessed."
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "article",
                    "attrs": {
                      "class": "manual-entry-card"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "•"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "Dependency classification missing"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "Impact analysis cannot explain what breaks."
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "article",
                    "attrs": {
                      "class": "manual-entry-card"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "•"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "Review date missing"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "Governance cannot maintain continual improvement cadence."
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "article",
                    "attrs": {
                      "class": "manual-entry-card"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "•"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "Exception missing"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "Known unresolved gaps need an explicit decision."
                          }
                        ]
                      }
                    ]
                  }
                ]
              },
              {
                "text": "\n\n      "
              },
              {
                "tag": "h2",
                "attrs": {},
                "children": [
                  {
                    "text": "Governance reviews and decisions"
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "p",
                "attrs": {},
                "children": [
                  {
                    "text": "A reviewer can approve, reject, defer or record an exception. The decision should include scope, rationale, expiry or follow-up where applicable. This creates an audit trail rather than a hidden judgement in a field."
                  }
                ]
              },
              {
                "text": "\n\n      "
              },
              {
                "tag": "h2",
                "attrs": {},
                "children": [
                  {
                    "text": "Typical scenarios"
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "div",
                "attrs": {
                  "class": "manual-entry-grid"
                },
                "children": [
                  {
                    "tag": "article",
                    "attrs": {
                      "class": "manual-entry-card"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "•"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "Service blocked before publish"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "Open readiness, fix missing evidence, request review, then record the decision."
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "article",
                    "attrs": {
                      "class": "manual-entry-card"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "•"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "Service approved with risk"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "Document the exception, owner, due date and mitigation path."
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "article",
                    "attrs": {
                      "class": "manual-entry-card"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "•"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "Owner is overloaded"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "Use owner load to redistribute responsibility or prioritize reviews."
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "article",
                    "attrs": {
                      "class": "manual-entry-card"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "•"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "Capability gap accepted temporarily"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "Record the accepted risk and review date."
                          }
                        ]
                      }
                    ]
                  }
                ]
              },
              {
                "text": "\n\n      "
              },
              {
                "tag": "figure",
                "attrs": {
                  "class": "screen-slot"
                },
                "children": [
                  {
                    "tag": "div",
                    "attrs": {},
                    "children": [
                      {
                        "text": "Screenshot: Governance"
                      },
                      {
                        "tag": "br",
                        "attrs": {}
                      },
                      {
                        "tag": "code",
                        "attrs": {},
                        "children": [
                          {
                            "text": "/img/help-en/06-governance.png"
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "figcaption",
                    "attrs": {},
                    "children": [
                      {
                        "text": "Use this slot for the current UI screenshot related to this chapter."
                      }
                    ]
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "div",
                "attrs": {
                  "class": "chapter-nav"
                },
                "children": [
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "a",
                    "attrs": {
                      "href": "/help-en/05-capabilities_c3"
                    },
                    "children": [
                      {
                        "text": "Previous: Capabilities and C3"
                      }
                    ]
                  },
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "a",
                    "attrs": {
                      "href": "/help-en/07-import"
                    },
                    "children": [
                      {
                        "text": "Next: Import"
                      }
                    ]
                  },
                  {
                    "text": "\n      "
                  }
                ]
              },
              {
                "text": "\n    "
              }
            ]
          },
          {
            "text": "\n  "
          }
        ]
      },
      {
        "text": "\n  \n"
      }
    ]
  },
  {
    "key": "07-import",
    "fileName": "07-import.html",
    "route": "/help-en/07-import",
    "locale": "en",
    "title": "Data import, dry-run validation and audit - S3C Manager Help",
    "body": [
      {
        "text": "\n  "
      },
      {
        "tag": "header",
        "attrs": {
          "class": "site-header"
        },
        "children": [
          {
            "text": "\n    "
          },
          {
            "tag": "a",
            "attrs": {
              "class": "back-to-app",
              "href": "/",
              "aria-label": "Back to application"
            },
            "children": [
              {
                "text": "← Back to application"
              }
            ]
          },
          {
            "text": "\n    "
          },
          {
            "tag": "button",
            "attrs": {
              "class": "hamburger",
              "type": "button",
              "aria-label": "Show menu"
            },
            "children": [
              {
                "text": "☰"
              }
            ]
          },
          {
            "text": "\n    "
          },
          {
            "tag": "a",
            "attrs": {
              "class": "logo",
              "href": "/help-en"
            },
            "children": [
              {
                "text": "S3C Manager"
              },
              {
                "tag": "span",
                "attrs": {},
                "children": [
                  {
                    "text": "Help manual"
                  }
                ]
              }
            ]
          },
          {
            "text": "\n    "
          },
          {
            "tag": "div",
            "attrs": {
              "class": "header-meta"
            },
            "children": [
              {
                "text": "07 · Import"
              }
            ]
          },
          {
            "text": "\n  "
          }
        ]
      },
      {
        "text": "\n  "
      },
      {
        "tag": "div",
        "attrs": {
          "class": "layout"
        },
        "children": [
          {
            "text": "\n\n    "
          },
          {
            "tag": "nav",
            "attrs": {
              "class": "sidebar",
              "id": "sidebar",
              "aria-label": "Help chapters"
            },
            "children": [
              {
                "text": "\n      "
              },
              {
                "tag": "section",
                "attrs": {
                  "class": "sidebar-section",
                  "aria-expanded": "true"
                },
                "children": [
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "button",
                    "attrs": {
                      "class": "sidebar-section-toggle",
                      "type": "button"
                    },
                    "children": [
                      {
                        "text": "Help chapters "
                      },
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "chevron"
                        },
                        "children": [
                          {
                            "text": "▾"
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "div",
                    "attrs": {
                      "class": "sidebar-section-panel"
                    },
                    "children": [
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "00"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Index"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "index.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/01-install"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "01"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Installation"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "01-install.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/02-welcome"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "02"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Application purpose"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "02-welcome.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/03-cocpit"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "03"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Cockpit"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "03-cocpit.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/04-services"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "04"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Services"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "04-services.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/05-capabilities_c3"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "05"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Capabilities and C3"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "05-capabilities_c3.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/06-governance"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "06"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Governance"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "06-governance.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link active",
                          "href": "/help-en/07-import"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "07"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Import"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "07-import.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/08-admin"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "08"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Administration"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "08-admin.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/09-user"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "09"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "User"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "09-user.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/10-analysis"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "10"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Analysis"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "10-analysis.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/11-api"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "11"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "API"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "11-api.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/12-abbrevations"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "12"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Abbreviations"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "12-abbrevations.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n        "
                      }
                    ]
                  },
                  {
                    "text": "\n      "
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "div",
                "attrs": {
                  "class": "sidebar-footer"
                },
                "children": [
                  {
                    "text": "The structure is manually maintained. Screenshots belong in "
                  },
                  {
                    "tag": "code",
                    "attrs": {},
                    "children": [
                      {
                        "text": "docs/help-en/img"
                      }
                    ]
                  },
                  {
                    "text": "."
                  }
                ]
              },
              {
                "text": "\n    "
              }
            ]
          },
          {
            "text": "\n    "
          },
          {
            "tag": "main",
            "attrs": {
              "class": "content"
            },
            "children": [
              {
                "text": "\n      "
              },
              {
                "tag": "section",
                "attrs": {
                  "class": "page-hero"
                },
                "children": [
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "p",
                    "attrs": {
                      "class": "chapter-kicker"
                    },
                    "children": [
                      {
                        "text": "07 Import"
                      }
                    ]
                  },
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "h1",
                    "attrs": {},
                    "children": [
                      {
                        "text": "Data import, dry-run validation and audit"
                      }
                    ]
                  },
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "p",
                    "attrs": {
                      "class": "lead"
                    },
                    "children": [
                      {
                        "text": "Import brings service, reference, C3, FMN and integration evidence into the application. The safest workflow is profile selection, file upload, dry-run preview, issue review and then controlled execution."
                      }
                    ]
                  },
                  {
                    "text": "\n      "
                  }
                ]
              },
              {
                "text": "\n\n      "
              },
              {
                "tag": "h2",
                "attrs": {},
                "children": [
                  {
                    "text": "Import process theory"
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "p",
                "attrs": {},
                "children": [
                  {
                    "text": "Import is a governed data intake process, not a blind upload. The application should show what will be created, updated, skipped or rejected before data is written to PostgreSQL."
                  }
                ]
              },
              {
                "text": "\n\n      "
              },
              {
                "tag": "h2",
                "attrs": {},
                "children": [
                  {
                    "text": "Route map"
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "table",
                "attrs": {
                  "class": "field-table"
                },
                "children": [
                  {
                    "tag": "thead",
                    "attrs": {},
                    "children": [
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "th",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Route"
                              }
                            ]
                          },
                          {
                            "tag": "th",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Purpose"
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "tbody",
                    "attrs": {},
                    "children": [
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "/import"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Import workspace for guided business import."
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "/import/upload"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Upload page with import target and profile selection."
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "/administration/import"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Administrative import profile management and reparsing."
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  }
                ]
              },
              {
                "text": "\n\n      "
              },
              {
                "tag": "h2",
                "attrs": {},
                "children": [
                  {
                    "text": "Supported formats and targets"
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "table",
                "attrs": {
                  "class": "field-table"
                },
                "children": [
                  {
                    "tag": "thead",
                    "attrs": {},
                    "children": [
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "th",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Format"
                              }
                            ]
                          },
                          {
                            "tag": "th",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Typical target"
                              }
                            ]
                          },
                          {
                            "tag": "th",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Notes"
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "tbody",
                    "attrs": {},
                    "children": [
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "CSV"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Services and reference data"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Requires stable column names and encoding."
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "JSON"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Services, C3 and integration payloads"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Best for system-to-system exchange."
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "XLSX"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Business-maintained import sheets"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Useful when source data comes from spreadsheet owners."
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "ArchiMate XML"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Architecture mapping evidence"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Maps architecture elements into service and capability context."
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  }
                ]
              },
              {
                "text": "\n\n      "
              },
              {
                "tag": "h2",
                "attrs": {},
                "children": [
                  {
                    "text": "Dry-run report"
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "p",
                "attrs": {},
                "children": [
                  {
                    "text": "A dry-run should be read before execution. Focus on unknown reference values, duplicate service IDs, missing owner, unmapped C3 capability, invalid lifecycle value and rows that would overwrite existing data."
                  }
                ]
              },
              {
                "text": "\n\n      "
              },
              {
                "tag": "h2",
                "attrs": {},
                "children": [
                  {
                    "text": "Post-import actions"
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "p",
                "attrs": {},
                "children": [
                  {
                    "text": "After import, open the service list, readiness queue, capability coverage and import audit. Imported evidence often needs owner confirmation, governance review or manual cleanup before publication."
                  }
                ]
              },
              {
                "text": "\n\n      "
              },
              {
                "tag": "figure",
                "attrs": {
                  "class": "screen-slot"
                },
                "children": [
                  {
                    "tag": "div",
                    "attrs": {},
                    "children": [
                      {
                        "text": "Screenshot: Import"
                      },
                      {
                        "tag": "br",
                        "attrs": {}
                      },
                      {
                        "tag": "code",
                        "attrs": {},
                        "children": [
                          {
                            "text": "/img/help-en/07-import.png"
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "figcaption",
                    "attrs": {},
                    "children": [
                      {
                        "text": "Use this slot for the current UI screenshot related to this chapter."
                      }
                    ]
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "div",
                "attrs": {
                  "class": "chapter-nav"
                },
                "children": [
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "a",
                    "attrs": {
                      "href": "/help-en/06-governance"
                    },
                    "children": [
                      {
                        "text": "Previous: Governance"
                      }
                    ]
                  },
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "a",
                    "attrs": {
                      "href": "/help-en/08-admin"
                    },
                    "children": [
                      {
                        "text": "Next: Administration"
                      }
                    ]
                  },
                  {
                    "text": "\n      "
                  }
                ]
              },
              {
                "text": "\n    "
              }
            ]
          },
          {
            "text": "\n  "
          }
        ]
      },
      {
        "text": "\n  \n"
      }
    ]
  },
  {
    "key": "08-admin",
    "fileName": "08-admin.html",
    "route": "/help-en/08-admin",
    "locale": "en",
    "title": "Administration panels, reference data, users and configuration scenarios - S3C Manager Help",
    "body": [
      {
        "text": "\n  "
      },
      {
        "tag": "header",
        "attrs": {
          "class": "site-header"
        },
        "children": [
          {
            "text": "\n    "
          },
          {
            "tag": "a",
            "attrs": {
              "class": "back-to-app",
              "href": "/",
              "aria-label": "Back to application"
            },
            "children": [
              {
                "text": "← Back to application"
              }
            ]
          },
          {
            "text": "\n    "
          },
          {
            "tag": "button",
            "attrs": {
              "class": "hamburger",
              "type": "button",
              "aria-label": "Show menu"
            },
            "children": [
              {
                "text": "☰"
              }
            ]
          },
          {
            "text": "\n    "
          },
          {
            "tag": "a",
            "attrs": {
              "class": "logo",
              "href": "/help-en"
            },
            "children": [
              {
                "text": "S3C Manager"
              },
              {
                "tag": "span",
                "attrs": {},
                "children": [
                  {
                    "text": "Help manual"
                  }
                ]
              }
            ]
          },
          {
            "text": "\n    "
          },
          {
            "tag": "div",
            "attrs": {
              "class": "header-meta"
            },
            "children": [
              {
                "text": "08 · Administration"
              }
            ]
          },
          {
            "text": "\n  "
          }
        ]
      },
      {
        "text": "\n  "
      },
      {
        "tag": "div",
        "attrs": {
          "class": "layout"
        },
        "children": [
          {
            "text": "\n\n    "
          },
          {
            "tag": "nav",
            "attrs": {
              "class": "sidebar",
              "id": "sidebar",
              "aria-label": "Help chapters"
            },
            "children": [
              {
                "text": "\n      "
              },
              {
                "tag": "section",
                "attrs": {
                  "class": "sidebar-section",
                  "aria-expanded": "true"
                },
                "children": [
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "button",
                    "attrs": {
                      "class": "sidebar-section-toggle",
                      "type": "button"
                    },
                    "children": [
                      {
                        "text": "Help chapters "
                      },
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "chevron"
                        },
                        "children": [
                          {
                            "text": "▾"
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "div",
                    "attrs": {
                      "class": "sidebar-section-panel"
                    },
                    "children": [
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "00"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Index"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "index.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/01-install"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "01"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Installation"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "01-install.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/02-welcome"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "02"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Application purpose"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "02-welcome.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/03-cocpit"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "03"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Cockpit"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "03-cocpit.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/04-services"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "04"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Services"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "04-services.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/05-capabilities_c3"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "05"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Capabilities and C3"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "05-capabilities_c3.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/06-governance"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "06"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Governance"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "06-governance.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/07-import"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "07"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Import"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "07-import.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link active",
                          "href": "/help-en/08-admin"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "08"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Administration"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "08-admin.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/09-user"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "09"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "User"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "09-user.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/10-analysis"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "10"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Analysis"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "10-analysis.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/11-api"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "11"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "API"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "11-api.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/12-abbrevations"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "12"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Abbreviations"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "12-abbrevations.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n        "
                      }
                    ]
                  },
                  {
                    "text": "\n      "
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "div",
                "attrs": {
                  "class": "sidebar-footer"
                },
                "children": [
                  {
                    "text": "The structure is manually maintained. Screenshots belong in "
                  },
                  {
                    "tag": "code",
                    "attrs": {},
                    "children": [
                      {
                        "text": "docs/help-en/img"
                      }
                    ]
                  },
                  {
                    "text": "."
                  }
                ]
              },
              {
                "text": "\n    "
              }
            ]
          },
          {
            "text": "\n    "
          },
          {
            "tag": "main",
            "attrs": {
              "class": "content"
            },
            "children": [
              {
                "text": "\n      "
              },
              {
                "tag": "section",
                "attrs": {
                  "class": "page-hero"
                },
                "children": [
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "p",
                    "attrs": {
                      "class": "chapter-kicker"
                    },
                    "children": [
                      {
                        "text": "08 Administration"
                      }
                    ]
                  },
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "h1",
                    "attrs": {},
                    "children": [
                      {
                        "text": "Administration panels, reference data, users and configuration scenarios"
                      }
                    ]
                  },
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "p",
                    "attrs": {
                      "class": "lead"
                    },
                    "children": [
                      {
                        "text": "Administration controls the safe operation of the instance: users, groups, roles, SSO, logs, reference data, import profiles, capability builder and installation diagnostics."
                      }
                    ]
                  },
                  {
                    "text": "\n      "
                  }
                ]
              },
              {
                "text": "\n\n      "
              },
              {
                "tag": "h2",
                "attrs": {},
                "children": [
                  {
                    "text": "Why administration matters"
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "p",
                "attrs": {},
                "children": [
                  {
                    "text": "Good administration keeps the catalogue understandable and secure. Poor reference data or roles can confuse users, hide tasks from reviewers, break imports or expose functions to the wrong audience."
                  }
                ]
              },
              {
                "text": "\n\n      "
              },
              {
                "tag": "h2",
                "attrs": {},
                "children": [
                  {
                    "text": "Administration areas"
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "table",
                "attrs": {
                  "class": "field-table"
                },
                "children": [
                  {
                    "tag": "thead",
                    "attrs": {},
                    "children": [
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "th",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Area"
                              }
                            ]
                          },
                          {
                            "tag": "th",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Route"
                              }
                            ]
                          },
                          {
                            "tag": "th",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Purpose"
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "tbody",
                    "attrs": {},
                    "children": [
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Overview"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "/administration"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Entry point for administrative tasks."
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Users"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "/administration/users"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Local users, AD/SSO identity mapping, roles and language preference."
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Groups"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "/administration/groups"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "RBAC grouping and membership."
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Auth / Web / SSO"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "/administration/web"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Trusted headers, SSO and public web settings."
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Reference data"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "/administration/catalogue-ref"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Controlled catalogues such as lifecycle, portfolio and classifications."
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Logs"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "/administration/logs"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Operational and audit visibility."
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Installation"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "/administration/installation"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Installed state, modules, schema and repair signals."
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  }
                ]
              },
              {
                "text": "\n\n      "
              },
              {
                "tag": "h2",
                "attrs": {},
                "children": [
                  {
                    "text": "Roles"
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "div",
                "attrs": {
                  "class": "manual-entry-grid"
                },
                "children": [
                  {
                    "tag": "article",
                    "attrs": {
                      "class": "manual-entry-card"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "•"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "User"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "Can browse the catalogue and consume readable service information."
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "article",
                    "attrs": {
                      "class": "manual-entry-card"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "•"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "Content admin / editor"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "Can maintain service and architecture content."
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "article",
                    "attrs": {
                      "class": "manual-entry-card"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "•"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "Administrator"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "Can manage users, roles, reference data, imports and instance settings."
                          }
                        ]
                      }
                    ]
                  }
                ]
              },
              {
                "text": "\n\n      "
              },
              {
                "tag": "h2",
                "attrs": {},
                "children": [
                  {
                    "text": "Common scenarios"
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "div",
                "attrs": {
                  "class": "manual-entry-grid"
                },
                "children": [
                  {
                    "tag": "article",
                    "attrs": {
                      "class": "manual-entry-card"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "•"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "New reviewer cannot see tasks"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "Check role, group membership, preferred language and assigned review ownership."
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "article",
                    "attrs": {
                      "class": "manual-entry-card"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "•"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "Import reports unknown portfolio code"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "Add or correct reference data before re-running import."
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "article",
                    "attrs": {
                      "class": "manual-entry-card"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "•"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "Enable SSO"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "Configure trusted headers or proxy integration, then test fallback local admin access."
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "article",
                    "attrs": {
                      "class": "manual-entry-card"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "•"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "New spiral baseline"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "Use capability builder and verify it appears in capability maps and import baselines."
                          }
                        ]
                      }
                    ]
                  }
                ]
              },
              {
                "text": "\n\n      "
              },
              {
                "tag": "figure",
                "attrs": {
                  "class": "screen-slot"
                },
                "children": [
                  {
                    "tag": "div",
                    "attrs": {},
                    "children": [
                      {
                        "text": "Screenshot: Administration"
                      },
                      {
                        "tag": "br",
                        "attrs": {}
                      },
                      {
                        "tag": "code",
                        "attrs": {},
                        "children": [
                          {
                            "text": "/img/help-en/08-admin.png"
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "figcaption",
                    "attrs": {},
                    "children": [
                      {
                        "text": "Use this slot for the current UI screenshot related to this chapter."
                      }
                    ]
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "div",
                "attrs": {
                  "class": "chapter-nav"
                },
                "children": [
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "a",
                    "attrs": {
                      "href": "/help-en/07-import"
                    },
                    "children": [
                      {
                        "text": "Previous: Import"
                      }
                    ]
                  },
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "a",
                    "attrs": {
                      "href": "/help-en/09-user"
                    },
                    "children": [
                      {
                        "text": "Next: User"
                      }
                    ]
                  },
                  {
                    "text": "\n      "
                  }
                ]
              },
              {
                "text": "\n    "
              }
            ]
          },
          {
            "text": "\n  "
          }
        ]
      },
      {
        "text": "\n  \n"
      }
    ]
  },
  {
    "key": "09-user",
    "fileName": "09-user.html",
    "route": "/help-en/09-user",
    "locale": "en",
    "title": "User menu, profile, preferences and roles - S3C Manager Help",
    "body": [
      {
        "text": "\n  "
      },
      {
        "tag": "header",
        "attrs": {
          "class": "site-header"
        },
        "children": [
          {
            "text": "\n    "
          },
          {
            "tag": "a",
            "attrs": {
              "class": "back-to-app",
              "href": "/",
              "aria-label": "Back to application"
            },
            "children": [
              {
                "text": "← Back to application"
              }
            ]
          },
          {
            "text": "\n    "
          },
          {
            "tag": "button",
            "attrs": {
              "class": "hamburger",
              "type": "button",
              "aria-label": "Show menu"
            },
            "children": [
              {
                "text": "☰"
              }
            ]
          },
          {
            "text": "\n    "
          },
          {
            "tag": "a",
            "attrs": {
              "class": "logo",
              "href": "/help-en"
            },
            "children": [
              {
                "text": "S3C Manager"
              },
              {
                "tag": "span",
                "attrs": {},
                "children": [
                  {
                    "text": "Help manual"
                  }
                ]
              }
            ]
          },
          {
            "text": "\n    "
          },
          {
            "tag": "div",
            "attrs": {
              "class": "header-meta"
            },
            "children": [
              {
                "text": "09 · User"
              }
            ]
          },
          {
            "text": "\n  "
          }
        ]
      },
      {
        "text": "\n  "
      },
      {
        "tag": "div",
        "attrs": {
          "class": "layout"
        },
        "children": [
          {
            "text": "\n\n    "
          },
          {
            "tag": "nav",
            "attrs": {
              "class": "sidebar",
              "id": "sidebar",
              "aria-label": "Help chapters"
            },
            "children": [
              {
                "text": "\n      "
              },
              {
                "tag": "section",
                "attrs": {
                  "class": "sidebar-section",
                  "aria-expanded": "true"
                },
                "children": [
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "button",
                    "attrs": {
                      "class": "sidebar-section-toggle",
                      "type": "button"
                    },
                    "children": [
                      {
                        "text": "Help chapters "
                      },
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "chevron"
                        },
                        "children": [
                          {
                            "text": "▾"
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "div",
                    "attrs": {
                      "class": "sidebar-section-panel"
                    },
                    "children": [
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "00"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Index"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "index.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/01-install"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "01"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Installation"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "01-install.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/02-welcome"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "02"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Application purpose"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "02-welcome.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/03-cocpit"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "03"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Cockpit"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "03-cocpit.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/04-services"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "04"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Services"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "04-services.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/05-capabilities_c3"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "05"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Capabilities and C3"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "05-capabilities_c3.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/06-governance"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "06"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Governance"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "06-governance.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/07-import"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "07"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Import"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "07-import.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/08-admin"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "08"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Administration"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "08-admin.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link active",
                          "href": "/help-en/09-user"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "09"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "User"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "09-user.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/10-analysis"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "10"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Analysis"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "10-analysis.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/11-api"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "11"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "API"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "11-api.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/12-abbrevations"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "12"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Abbreviations"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "12-abbrevations.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n        "
                      }
                    ]
                  },
                  {
                    "text": "\n      "
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "div",
                "attrs": {
                  "class": "sidebar-footer"
                },
                "children": [
                  {
                    "text": "The structure is manually maintained. Screenshots belong in "
                  },
                  {
                    "tag": "code",
                    "attrs": {},
                    "children": [
                      {
                        "text": "docs/help-en/img"
                      }
                    ]
                  },
                  {
                    "text": "."
                  }
                ]
              },
              {
                "text": "\n    "
              }
            ]
          },
          {
            "text": "\n    "
          },
          {
            "tag": "main",
            "attrs": {
              "class": "content"
            },
            "children": [
              {
                "text": "\n      "
              },
              {
                "tag": "section",
                "attrs": {
                  "class": "page-hero"
                },
                "children": [
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "p",
                    "attrs": {
                      "class": "chapter-kicker"
                    },
                    "children": [
                      {
                        "text": "09 User"
                      }
                    ]
                  },
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "h1",
                    "attrs": {},
                    "children": [
                      {
                        "text": "User menu, profile, preferences and roles"
                      }
                    ]
                  },
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "p",
                    "attrs": {
                      "class": "lead"
                    },
                    "children": [
                      {
                        "text": "The user profile controls personal identity, language, password and role-visible work. It also explains why different users may see different navigation or actions."
                      }
                    ]
                  },
                  {
                    "text": "\n      "
                  }
                ]
              },
              {
                "text": "\n\n      "
              },
              {
                "tag": "h2",
                "attrs": {},
                "children": [
                  {
                    "text": "User menu"
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "p",
                "attrs": {},
                "children": [
                  {
                    "text": "The user menu gives access to profile settings, language preference, password change when local authentication is used, and sign-out."
                  }
                ]
              },
              {
                "text": "\n\n      "
              },
              {
                "tag": "h2",
                "attrs": {},
                "children": [
                  {
                    "text": "Profile fields"
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "table",
                "attrs": {
                  "class": "field-table"
                },
                "children": [
                  {
                    "tag": "thead",
                    "attrs": {},
                    "children": [
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "th",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Field"
                              }
                            ]
                          },
                          {
                            "tag": "th",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Meaning"
                              }
                            ]
                          },
                          {
                            "tag": "th",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Impact"
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "tbody",
                    "attrs": {},
                    "children": [
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Display name"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Human-readable user name."
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Used in ownership, reviews and audit context."
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Email"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Contact and future notification address."
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Helps reviewers and owners identify accountable users."
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Preferred language"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "cs or en."
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Controls UI language, locale cookie and help link target."
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Role"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "User, editor/content admin or administrator."
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Controls navigation and permitted actions."
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  }
                ]
              },
              {
                "text": "\n\n      "
              },
              {
                "tag": "h2",
                "attrs": {},
                "children": [
                  {
                    "text": "Language preference and help"
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "p",
                "attrs": {},
                "children": [
                  {
                    "text": "When preferred language is Czech, the Help link opens help-cs. When preferred language is English, it opens help-en. The same locale is stored in the sc_locale cookie for server-side redirects."
                  }
                ]
              },
              {
                "text": "\n\n      "
              },
              {
                "tag": "h2",
                "attrs": {},
                "children": [
                  {
                    "text": "Common issues"
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "div",
                "attrs": {
                  "class": "manual-entry-grid"
                },
                "children": [
                  {
                    "tag": "article",
                    "attrs": {
                      "class": "manual-entry-card"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "•"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "I do not see my review"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "Check that the review is assigned to your user or group and that your role permits review work."
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "article",
                    "attrs": {
                      "class": "manual-entry-card"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "•"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "I want a less technical view"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "Use catalogue, service detail and cockpit first; expert C3 and raw import evidence are meant for administrators and architects."
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "article",
                    "attrs": {
                      "class": "manual-entry-card"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "•"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "I cannot change password"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "Password change is available for local accounts. SSO or AD accounts are managed by the identity provider."
                          }
                        ]
                      }
                    ]
                  }
                ]
              },
              {
                "text": "\n\n      "
              },
              {
                "tag": "figure",
                "attrs": {
                  "class": "screen-slot"
                },
                "children": [
                  {
                    "tag": "div",
                    "attrs": {},
                    "children": [
                      {
                        "text": "Screenshot: User"
                      },
                      {
                        "tag": "br",
                        "attrs": {}
                      },
                      {
                        "tag": "code",
                        "attrs": {},
                        "children": [
                          {
                            "text": "/img/help-en/09-user.png"
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "figcaption",
                    "attrs": {},
                    "children": [
                      {
                        "text": "Use this slot for the current UI screenshot related to this chapter."
                      }
                    ]
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "div",
                "attrs": {
                  "class": "chapter-nav"
                },
                "children": [
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "a",
                    "attrs": {
                      "href": "/help-en/08-admin"
                    },
                    "children": [
                      {
                        "text": "Previous: Administration"
                      }
                    ]
                  },
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "a",
                    "attrs": {
                      "href": "/help-en/10-analysis"
                    },
                    "children": [
                      {
                        "text": "Next: Analysis"
                      }
                    ]
                  },
                  {
                    "text": "\n      "
                  }
                ]
              },
              {
                "text": "\n    "
              }
            ]
          },
          {
            "text": "\n  "
          }
        ]
      },
      {
        "text": "\n  \n"
      }
    ]
  },
  {
    "key": "10-analysis",
    "fileName": "10-analysis.html",
    "route": "/help-en/10-analysis",
    "locale": "en",
    "title": "Graphs, impact, gaps and problem diagnostics - S3C Manager Help",
    "body": [
      {
        "text": "\n  "
      },
      {
        "tag": "header",
        "attrs": {
          "class": "site-header"
        },
        "children": [
          {
            "text": "\n    "
          },
          {
            "tag": "a",
            "attrs": {
              "class": "back-to-app",
              "href": "/",
              "aria-label": "Back to application"
            },
            "children": [
              {
                "text": "← Back to application"
              }
            ]
          },
          {
            "text": "\n    "
          },
          {
            "tag": "button",
            "attrs": {
              "class": "hamburger",
              "type": "button",
              "aria-label": "Show menu"
            },
            "children": [
              {
                "text": "☰"
              }
            ]
          },
          {
            "text": "\n    "
          },
          {
            "tag": "a",
            "attrs": {
              "class": "logo",
              "href": "/help-en"
            },
            "children": [
              {
                "text": "S3C Manager"
              },
              {
                "tag": "span",
                "attrs": {},
                "children": [
                  {
                    "text": "Help manual"
                  }
                ]
              }
            ]
          },
          {
            "text": "\n    "
          },
          {
            "tag": "div",
            "attrs": {
              "class": "header-meta"
            },
            "children": [
              {
                "text": "10 · Analysis"
              }
            ]
          },
          {
            "text": "\n  "
          }
        ]
      },
      {
        "text": "\n  "
      },
      {
        "tag": "div",
        "attrs": {
          "class": "layout"
        },
        "children": [
          {
            "text": "\n\n    "
          },
          {
            "tag": "nav",
            "attrs": {
              "class": "sidebar",
              "id": "sidebar",
              "aria-label": "Help chapters"
            },
            "children": [
              {
                "text": "\n      "
              },
              {
                "tag": "section",
                "attrs": {
                  "class": "sidebar-section",
                  "aria-expanded": "true"
                },
                "children": [
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "button",
                    "attrs": {
                      "class": "sidebar-section-toggle",
                      "type": "button"
                    },
                    "children": [
                      {
                        "text": "Help chapters "
                      },
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "chevron"
                        },
                        "children": [
                          {
                            "text": "▾"
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "div",
                    "attrs": {
                      "class": "sidebar-section-panel"
                    },
                    "children": [
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "00"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Index"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "index.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/01-install"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "01"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Installation"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "01-install.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/02-welcome"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "02"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Application purpose"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "02-welcome.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/03-cocpit"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "03"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Cockpit"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "03-cocpit.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/04-services"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "04"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Services"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "04-services.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/05-capabilities_c3"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "05"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Capabilities and C3"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "05-capabilities_c3.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/06-governance"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "06"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Governance"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "06-governance.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/07-import"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "07"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Import"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "07-import.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/08-admin"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "08"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Administration"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "08-admin.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/09-user"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "09"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "User"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "09-user.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link active",
                          "href": "/help-en/10-analysis"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "10"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Analysis"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "10-analysis.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/11-api"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "11"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "API"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "11-api.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/12-abbrevations"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "12"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Abbreviations"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "12-abbrevations.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n        "
                      }
                    ]
                  },
                  {
                    "text": "\n      "
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "div",
                "attrs": {
                  "class": "sidebar-footer"
                },
                "children": [
                  {
                    "text": "The structure is manually maintained. Screenshots belong in "
                  },
                  {
                    "tag": "code",
                    "attrs": {},
                    "children": [
                      {
                        "text": "docs/help-en/img"
                      }
                    ]
                  },
                  {
                    "text": "."
                  }
                ]
              },
              {
                "text": "\n    "
              }
            ]
          },
          {
            "text": "\n    "
          },
          {
            "tag": "main",
            "attrs": {
              "class": "content"
            },
            "children": [
              {
                "text": "\n      "
              },
              {
                "tag": "section",
                "attrs": {
                  "class": "page-hero"
                },
                "children": [
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "p",
                    "attrs": {
                      "class": "chapter-kicker"
                    },
                    "children": [
                      {
                        "text": "10 Analysis"
                      }
                    ]
                  },
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "h1",
                    "attrs": {},
                    "children": [
                      {
                        "text": "Graphs, impact, gaps and problem diagnostics"
                      }
                    ]
                  },
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "p",
                    "attrs": {
                      "class": "lead"
                    },
                    "children": [
                      {
                        "text": "Analysis views help users answer what depends on what, where coverage is missing, which C3 items are affected and why a service is not ready."
                      }
                    ]
                  },
                  {
                    "text": "\n      "
                  }
                ]
              },
              {
                "text": "\n\n      "
              },
              {
                "tag": "h2",
                "attrs": {},
                "children": [
                  {
                    "text": "Analysis theory"
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "p",
                "attrs": {},
                "children": [
                  {
                    "text": "A catalogue is useful only when it can explain consequences. Graphs, readiness diagnostics, gaps and overlaps turn static records into decisions."
                  }
                ]
              },
              {
                "text": "\n\n      "
              },
              {
                "tag": "h2",
                "attrs": {},
                "children": [
                  {
                    "text": "Analytical views"
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "table",
                "attrs": {
                  "class": "field-table"
                },
                "children": [
                  {
                    "tag": "thead",
                    "attrs": {},
                    "children": [
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "th",
                            "attrs": {},
                            "children": [
                              {
                                "text": "View"
                              }
                            ]
                          },
                          {
                            "tag": "th",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Purpose"
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "tbody",
                    "attrs": {},
                    "children": [
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Services Graph"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Shows service-to-service and dependency relations."
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Service detail graph"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Focuses on one service and its neighborhood."
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "C3 Graph"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Shows C3 taxonomy relations and linked entities."
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Impact Analysis"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Explains what could break when a service, capability or C3 item changes."
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Capability gaps and overlaps"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Shows where services are missing or duplicated for capabilities."
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  }
                ]
              },
              {
                "text": "\n\n      "
              },
              {
                "tag": "h2",
                "attrs": {},
                "children": [
                  {
                    "text": "How to diagnose a service problem"
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "p",
                "attrs": {},
                "children": [
                  {
                    "text": "Open service detail, read readiness warnings, inspect ownership and offering evidence, then follow dependencies in the graph. If a warning is architecture-related, continue to capability mapping or C3 detail."
                  }
                ]
              },
              {
                "text": "\n\n      "
              },
              {
                "tag": "h2",
                "attrs": {},
                "children": [
                  {
                    "text": "Common mistakes"
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "p",
                "attrs": {},
                "children": [
                  {
                    "text": "Do not treat graph distance as business criticality. A nearby node can be low risk and a distant dependency can be critical. Always combine graph context with lifecycle, owner, SLA, decision records and dependency type."
                  }
                ]
              },
              {
                "text": "\n\n      "
              },
              {
                "tag": "figure",
                "attrs": {
                  "class": "screen-slot"
                },
                "children": [
                  {
                    "tag": "div",
                    "attrs": {},
                    "children": [
                      {
                        "text": "Screenshot: Analysis"
                      },
                      {
                        "tag": "br",
                        "attrs": {}
                      },
                      {
                        "tag": "code",
                        "attrs": {},
                        "children": [
                          {
                            "text": "/img/help-en/10-analysis.png"
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "figcaption",
                    "attrs": {},
                    "children": [
                      {
                        "text": "Use this slot for the current UI screenshot related to this chapter."
                      }
                    ]
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "div",
                "attrs": {
                  "class": "chapter-nav"
                },
                "children": [
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "a",
                    "attrs": {
                      "href": "/help-en/09-user"
                    },
                    "children": [
                      {
                        "text": "Previous: User"
                      }
                    ]
                  },
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "a",
                    "attrs": {
                      "href": "/help-en/11-api"
                    },
                    "children": [
                      {
                        "text": "Next: API"
                      }
                    ]
                  },
                  {
                    "text": "\n      "
                  }
                ]
              },
              {
                "text": "\n    "
              }
            ]
          },
          {
            "text": "\n  "
          }
        ]
      },
      {
        "text": "\n  \n"
      }
    ]
  },
  {
    "key": "11-api",
    "fileName": "11-api.html",
    "route": "/help-en/11-api",
    "locale": "en",
    "title": "API parameters and integration scenarios - S3C Manager Help",
    "body": [
      {
        "text": "\n  "
      },
      {
        "tag": "header",
        "attrs": {
          "class": "site-header"
        },
        "children": [
          {
            "text": "\n    "
          },
          {
            "tag": "a",
            "attrs": {
              "class": "back-to-app",
              "href": "/",
              "aria-label": "Back to application"
            },
            "children": [
              {
                "text": "← Back to application"
              }
            ]
          },
          {
            "text": "\n    "
          },
          {
            "tag": "button",
            "attrs": {
              "class": "hamburger",
              "type": "button",
              "aria-label": "Show menu"
            },
            "children": [
              {
                "text": "☰"
              }
            ]
          },
          {
            "text": "\n    "
          },
          {
            "tag": "a",
            "attrs": {
              "class": "logo",
              "href": "/help-en"
            },
            "children": [
              {
                "text": "S3C Manager"
              },
              {
                "tag": "span",
                "attrs": {},
                "children": [
                  {
                    "text": "Help manual"
                  }
                ]
              }
            ]
          },
          {
            "text": "\n    "
          },
          {
            "tag": "div",
            "attrs": {
              "class": "header-meta"
            },
            "children": [
              {
                "text": "11 · API"
              }
            ]
          },
          {
            "text": "\n  "
          }
        ]
      },
      {
        "text": "\n  "
      },
      {
        "tag": "div",
        "attrs": {
          "class": "layout"
        },
        "children": [
          {
            "text": "\n\n    "
          },
          {
            "tag": "nav",
            "attrs": {
              "class": "sidebar",
              "id": "sidebar",
              "aria-label": "Help chapters"
            },
            "children": [
              {
                "text": "\n      "
              },
              {
                "tag": "section",
                "attrs": {
                  "class": "sidebar-section",
                  "aria-expanded": "true"
                },
                "children": [
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "button",
                    "attrs": {
                      "class": "sidebar-section-toggle",
                      "type": "button"
                    },
                    "children": [
                      {
                        "text": "Help chapters "
                      },
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "chevron"
                        },
                        "children": [
                          {
                            "text": "▾"
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "div",
                    "attrs": {
                      "class": "sidebar-section-panel"
                    },
                    "children": [
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "00"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Index"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "index.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/01-install"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "01"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Installation"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "01-install.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/02-welcome"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "02"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Application purpose"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "02-welcome.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/03-cocpit"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "03"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Cockpit"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "03-cocpit.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/04-services"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "04"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Services"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "04-services.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/05-capabilities_c3"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "05"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Capabilities and C3"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "05-capabilities_c3.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/06-governance"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "06"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Governance"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "06-governance.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/07-import"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "07"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Import"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "07-import.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/08-admin"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "08"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Administration"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "08-admin.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/09-user"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "09"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "User"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "09-user.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/10-analysis"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "10"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Analysis"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "10-analysis.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link active",
                          "href": "/help-en/11-api"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "11"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "API"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "11-api.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/12-abbrevations"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "12"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Abbreviations"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "12-abbrevations.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n        "
                      }
                    ]
                  },
                  {
                    "text": "\n      "
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "div",
                "attrs": {
                  "class": "sidebar-footer"
                },
                "children": [
                  {
                    "text": "The structure is manually maintained. Screenshots belong in "
                  },
                  {
                    "tag": "code",
                    "attrs": {},
                    "children": [
                      {
                        "text": "docs/help-en/img"
                      }
                    ]
                  },
                  {
                    "text": "."
                  }
                ]
              },
              {
                "text": "\n    "
              }
            ]
          },
          {
            "text": "\n    "
          },
          {
            "tag": "main",
            "attrs": {
              "class": "content"
            },
            "children": [
              {
                "text": "\n      "
              },
              {
                "tag": "section",
                "attrs": {
                  "class": "page-hero"
                },
                "children": [
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "p",
                    "attrs": {
                      "class": "chapter-kicker"
                    },
                    "children": [
                      {
                        "text": "11 API"
                      }
                    ]
                  },
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "h1",
                    "attrs": {},
                    "children": [
                      {
                        "text": "API parameters and integration scenarios"
                      }
                    ]
                  },
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "p",
                    "attrs": {
                      "class": "lead"
                    },
                    "children": [
                      {
                        "text": "The API lets other tools read catalogue, service, C3, governance and import context. It should be used with RBAC, authenticated sessions and clear ownership of integrations."
                      }
                    ]
                  },
                  {
                    "text": "\n      "
                  }
                ]
              },
              {
                "text": "\n\n      "
              },
              {
                "tag": "h2",
                "attrs": {},
                "children": [
                  {
                    "text": "General API rules"
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "p",
                "attrs": {},
                "children": [
                  {
                    "text": "Use versioned endpoints, authenticated request links, least-privilege roles, stable query parameters and safe error handling. Retired endpoints should return explicit 410 responses until their compatibility window expires."
                  }
                ]
              },
              {
                "text": "\n\n      "
              },
              {
                "tag": "h2",
                "attrs": {},
                "children": [
                  {
                    "text": "API groups"
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "table",
                "attrs": {
                  "class": "field-table"
                },
                "children": [
                  {
                    "tag": "thead",
                    "attrs": {},
                    "children": [
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "th",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Group"
                              }
                            ]
                          },
                          {
                            "tag": "th",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Purpose"
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "tbody",
                    "attrs": {},
                    "children": [
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Auth and session"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Login, refresh, current user and preferences."
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Services"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Catalogue list, service detail, editor data, relations and offerings."
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "C3 and capabilities"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Taxonomy, capability coverage, maps and C3 entity families."
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Graph and impact"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Graph nodes, edges and impact analysis."
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Governance and readiness"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Review queues, decisions, exceptions and readiness diagnostics."
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Import, export and search"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Upload, dry-run, import execution, exports and global search."
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Admin and reference"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Users, groups, reference data, installation and logs."
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  }
                ]
              },
              {
                "text": "\n\n      "
              },
              {
                "tag": "h2",
                "attrs": {},
                "children": [
                  {
                    "text": "Integration scenarios"
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "div",
                "attrs": {
                  "class": "manual-entry-grid"
                },
                "children": [
                  {
                    "tag": "article",
                    "attrs": {
                      "class": "manual-entry-card"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "•"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "ITSM portal"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "Reads requestable service offerings and links users to the correct request channel."
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "article",
                    "attrs": {
                      "class": "manual-entry-card"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "•"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "EA repository"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "Exchanges capability and architecture evidence without replacing the modelling tool."
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "article",
                    "attrs": {
                      "class": "manual-entry-card"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "•"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "Reporting dashboard"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "Reads readiness, owner load, portfolio and decision metrics."
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "article",
                    "attrs": {
                      "class": "manual-entry-card"
                    },
                    "children": [
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "manual-entry-head"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "manual-entry-number"
                            },
                            "children": [
                              {
                                "text": "•"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "tag": "strong",
                                "attrs": {
                                  "class": "manual-entry-title"
                                },
                                "children": [
                                  {
                                    "text": "Import pipeline"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "p",
                        "attrs": {},
                        "children": [
                          {
                            "text": "Pushes validated service or C3 evidence through dry-run and controlled execution."
                          }
                        ]
                      }
                    ]
                  }
                ]
              },
              {
                "text": "\n\n      "
              },
              {
                "tag": "h2",
                "attrs": {},
                "children": [
                  {
                    "text": "Common integration mistakes"
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "p",
                "attrs": {},
                "children": [
                  {
                    "text": "Do not hard-code retired endpoints, bypass RBAC, parse user-facing labels as identifiers or ignore pagination. For write integrations, always test dry-run and audit output before enabling production execution."
                  }
                ]
              },
              {
                "text": "\n\n      "
              },
              {
                "tag": "figure",
                "attrs": {
                  "class": "screen-slot"
                },
                "children": [
                  {
                    "tag": "div",
                    "attrs": {},
                    "children": [
                      {
                        "text": "Screenshot: API"
                      },
                      {
                        "tag": "br",
                        "attrs": {}
                      },
                      {
                        "tag": "code",
                        "attrs": {},
                        "children": [
                          {
                            "text": "/img/help-en/11-api.png"
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "figcaption",
                    "attrs": {},
                    "children": [
                      {
                        "text": "Use this slot for the current UI screenshot related to this chapter."
                      }
                    ]
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "div",
                "attrs": {
                  "class": "chapter-nav"
                },
                "children": [
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "a",
                    "attrs": {
                      "href": "/help-en/10-analysis"
                    },
                    "children": [
                      {
                        "text": "Previous: Analysis"
                      }
                    ]
                  },
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "a",
                    "attrs": {
                      "href": "/help-en/12-abbrevations"
                    },
                    "children": [
                      {
                        "text": "Next: Abbreviations"
                      }
                    ]
                  },
                  {
                    "text": "\n      "
                  }
                ]
              },
              {
                "text": "\n    "
              }
            ]
          },
          {
            "text": "\n  "
          }
        ]
      },
      {
        "text": "\n  \n"
      }
    ]
  },
  {
    "key": "12-abbrevations",
    "fileName": "12-abbrevations.html",
    "route": "/help-en/12-abbrevations",
    "locale": "en",
    "title": "Glossary of abbreviations, terms and statuses - S3C Manager Help",
    "body": [
      {
        "text": "\n  "
      },
      {
        "tag": "header",
        "attrs": {
          "class": "site-header"
        },
        "children": [
          {
            "text": "\n    "
          },
          {
            "tag": "a",
            "attrs": {
              "class": "back-to-app",
              "href": "/",
              "aria-label": "Back to application"
            },
            "children": [
              {
                "text": "← Back to application"
              }
            ]
          },
          {
            "text": "\n    "
          },
          {
            "tag": "button",
            "attrs": {
              "class": "hamburger",
              "type": "button",
              "aria-label": "Show menu"
            },
            "children": [
              {
                "text": "☰"
              }
            ]
          },
          {
            "text": "\n    "
          },
          {
            "tag": "a",
            "attrs": {
              "class": "logo",
              "href": "/help-en"
            },
            "children": [
              {
                "text": "S3C Manager"
              },
              {
                "tag": "span",
                "attrs": {},
                "children": [
                  {
                    "text": "Help manual"
                  }
                ]
              }
            ]
          },
          {
            "text": "\n    "
          },
          {
            "tag": "div",
            "attrs": {
              "class": "header-meta"
            },
            "children": [
              {
                "text": "12 · Abbreviations"
              }
            ]
          },
          {
            "text": "\n  "
          }
        ]
      },
      {
        "text": "\n  "
      },
      {
        "tag": "div",
        "attrs": {
          "class": "layout"
        },
        "children": [
          {
            "text": "\n\n    "
          },
          {
            "tag": "nav",
            "attrs": {
              "class": "sidebar",
              "id": "sidebar",
              "aria-label": "Help chapters"
            },
            "children": [
              {
                "text": "\n      "
              },
              {
                "tag": "section",
                "attrs": {
                  "class": "sidebar-section",
                  "aria-expanded": "true"
                },
                "children": [
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "button",
                    "attrs": {
                      "class": "sidebar-section-toggle",
                      "type": "button"
                    },
                    "children": [
                      {
                        "text": "Help chapters "
                      },
                      {
                        "tag": "span",
                        "attrs": {
                          "class": "chevron"
                        },
                        "children": [
                          {
                            "text": "▾"
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "div",
                    "attrs": {
                      "class": "sidebar-section-panel"
                    },
                    "children": [
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "00"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Index"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "index.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/01-install"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "01"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Installation"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "01-install.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/02-welcome"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "02"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Application purpose"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "02-welcome.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/03-cocpit"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "03"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Cockpit"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "03-cocpit.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/04-services"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "04"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Services"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "04-services.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/05-capabilities_c3"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "05"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Capabilities and C3"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "05-capabilities_c3.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/06-governance"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "06"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Governance"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "06-governance.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/07-import"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "07"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Import"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "07-import.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/08-admin"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "08"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Administration"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "08-admin.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/09-user"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "09"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "User"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "09-user.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/10-analysis"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "10"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Analysis"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "10-analysis.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link",
                          "href": "/help-en/11-api"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "11"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "API"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "11-api.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n          "
                      },
                      {
                        "tag": "a",
                        "attrs": {
                          "class": "nav-link active",
                          "href": "/help-en/12-abbrevations"
                        },
                        "children": [
                          {
                            "tag": "span",
                            "attrs": {
                              "class": "nav-icon"
                            },
                            "children": [
                              {
                                "text": "12"
                              }
                            ]
                          },
                          {
                            "tag": "span",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Abbreviations"
                              },
                              {
                                "tag": "span",
                                "attrs": {
                                  "class": "route"
                                },
                                "children": [
                                  {
                                    "text": "12-abbrevations.html"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "text": "\n        "
                      }
                    ]
                  },
                  {
                    "text": "\n      "
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "div",
                "attrs": {
                  "class": "sidebar-footer"
                },
                "children": [
                  {
                    "text": "The structure is manually maintained. Screenshots belong in "
                  },
                  {
                    "tag": "code",
                    "attrs": {},
                    "children": [
                      {
                        "text": "docs/help-en/img"
                      }
                    ]
                  },
                  {
                    "text": "."
                  }
                ]
              },
              {
                "text": "\n    "
              }
            ]
          },
          {
            "text": "\n    "
          },
          {
            "tag": "main",
            "attrs": {
              "class": "content"
            },
            "children": [
              {
                "text": "\n      "
              },
              {
                "tag": "section",
                "attrs": {
                  "class": "page-hero"
                },
                "children": [
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "p",
                    "attrs": {
                      "class": "chapter-kicker"
                    },
                    "children": [
                      {
                        "text": "12 Abbreviations"
                      }
                    ]
                  },
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "h1",
                    "attrs": {},
                    "children": [
                      {
                        "text": "Glossary of abbreviations, terms and statuses"
                      }
                    ]
                  },
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "p",
                    "attrs": {
                      "class": "lead"
                    },
                    "children": [
                      {
                        "text": "This chapter explains frequent terms used in S3C Manager, ITIL, TOGAF, C3, FMN, APIs and workflow states. It helps managers, administrators and architects use the same vocabulary."
                      }
                    ]
                  },
                  {
                    "text": "\n      "
                  }
                ]
              },
              {
                "text": "\n\n      "
              },
              {
                "tag": "h2",
                "attrs": {},
                "children": [
                  {
                    "text": "Application terms"
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "table",
                "attrs": {
                  "class": "field-table"
                },
                "children": [
                  {
                    "tag": "thead",
                    "attrs": {},
                    "children": [
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "th",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Term"
                              }
                            ]
                          },
                          {
                            "tag": "th",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Meaning"
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "tbody",
                    "attrs": {},
                    "children": [
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Service"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Managed catalogue item with owner, lifecycle, offering, support and governance context."
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Offering evidence"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Consumer-facing proof of what can be requested or consumed."
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Readiness"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Set of checks showing whether a service is ready for publication, change or operation."
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Decision"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Auditable governance record such as approve, reject, defer or exception."
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Capability"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Business or mission ability supported by services and C3 elements."
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "C3"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Command, Control and Communication taxonomy context."
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "FMN spiral"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Baseline grouping used for capability and C3 context."
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  }
                ]
              },
              {
                "text": "\n\n      "
              },
              {
                "tag": "h2",
                "attrs": {},
                "children": [
                  {
                    "text": "ITIL and ITSM"
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "table",
                "attrs": {
                  "class": "field-table"
                },
                "children": [
                  {
                    "tag": "thead",
                    "attrs": {},
                    "children": [
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "th",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Term"
                              }
                            ]
                          },
                          {
                            "tag": "th",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Meaning"
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "tbody",
                    "attrs": {},
                    "children": [
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "SLA"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Service Level Agreement."
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "OLA"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Operational Level Agreement."
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Service catalogue"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Authoritative user-facing list of services."
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Change enablement"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Controlled process for evaluating and approving changes."
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Continual improvement"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Ongoing cycle of reviewing and improving services."
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  }
                ]
              },
              {
                "text": "\n\n      "
              },
              {
                "tag": "h2",
                "attrs": {},
                "children": [
                  {
                    "text": "TOGAF, EA and ArchiMate"
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "table",
                "attrs": {
                  "class": "field-table"
                },
                "children": [
                  {
                    "tag": "thead",
                    "attrs": {},
                    "children": [
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "th",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Term"
                              }
                            ]
                          },
                          {
                            "tag": "th",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Meaning"
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "tbody",
                    "attrs": {},
                    "children": [
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "EA"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Enterprise Architecture."
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Capability map"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Structured map of organizational or mission capabilities."
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Application component"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Architecture element representing an application."
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Data object"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Architecture element representing data used or produced by services."
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  }
                ]
              },
              {
                "text": "\n\n      "
              },
              {
                "tag": "h2",
                "attrs": {},
                "children": [
                  {
                    "text": "Workflow statuses"
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "table",
                "attrs": {
                  "class": "field-table"
                },
                "children": [
                  {
                    "tag": "thead",
                    "attrs": {},
                    "children": [
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "th",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Status"
                              }
                            ]
                          },
                          {
                            "tag": "th",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Meaning"
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "tbody",
                    "attrs": {},
                    "children": [
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Draft"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Service is being prepared and is not ready for normal consumption."
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Active"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Service is published or operational."
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Retiring"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Service is being phased out."
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Retired"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Service is no longer active."
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Approved"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Reviewer accepted the decision scope."
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Deferred"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Decision is postponed."
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "tr",
                        "attrs": {},
                        "children": [
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Exception"
                              }
                            ]
                          },
                          {
                            "tag": "td",
                            "attrs": {},
                            "children": [
                              {
                                "text": "Known gap or risk is accepted under documented conditions."
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  }
                ]
              },
              {
                "text": "\n\n      "
              },
              {
                "tag": "h2",
                "attrs": {},
                "children": [
                  {
                    "text": "How to use the glossary"
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "p",
                "attrs": {},
                "children": [
                  {
                    "text": "When a cockpit badge or field name is unclear, open the glossary first, then continue to the chapter for that application area. This keeps users aligned on the same meaning before they change data or record a decision."
                  }
                ]
              },
              {
                "text": "\n\n      "
              },
              {
                "tag": "figure",
                "attrs": {
                  "class": "screen-slot"
                },
                "children": [
                  {
                    "tag": "div",
                    "attrs": {},
                    "children": [
                      {
                        "text": "Screenshot: Abbreviations"
                      },
                      {
                        "tag": "br",
                        "attrs": {}
                      },
                      {
                        "tag": "code",
                        "attrs": {},
                        "children": [
                          {
                            "text": "/img/help-en/12-abbrevations.png"
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "figcaption",
                    "attrs": {},
                    "children": [
                      {
                        "text": "Use this slot for the current UI screenshot related to this chapter."
                      }
                    ]
                  }
                ]
              },
              {
                "text": "\n      "
              },
              {
                "tag": "div",
                "attrs": {
                  "class": "chapter-nav"
                },
                "children": [
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "a",
                    "attrs": {
                      "href": "/help-en/11-api"
                    },
                    "children": [
                      {
                        "text": "Previous: API"
                      }
                    ]
                  },
                  {
                    "text": "\n        "
                  },
                  {
                    "tag": "span",
                    "attrs": {}
                  },
                  {
                    "text": "\n      "
                  }
                ]
              },
              {
                "text": "\n    "
              }
            ]
          },
          {
            "text": "\n  "
          }
        ]
      },
      {
        "text": "\n  \n"
      }
    ]
  }
];
