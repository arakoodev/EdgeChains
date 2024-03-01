import { html } from "hono/html";
const ExampleLayout = (props) => html`
<!DOCTYPE html>
    <html xmlns="http://www.w3.org/1999/xhtml"
          xmlns:th="http://www.thymeleaf.org"
          lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Document</title>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/core@1.0.0-beta17/dist/css/tabler.min.css">
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/core@1.0.0-beta17/dist/css/tabler-flags.min.css">
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/core@1.0.0-beta17/dist/css/tabler-payments.min.css">
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/core@1.0.0-beta17/dist/css/tabler-vendors.min.css">
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/core@1.0.0-beta17/dist/css/demo.min.css">
        <style>
            #rrfFields{
                display: none;
            }
            #main--card{
                height: 7rem;
            }
        </style>
    </head>
    <body>
    <div class="page">
        <header class="navbar navbar-expand-sm navbar-light d-print-none">
            <div class="container-xl">
                <h1 class="navbar-brand navbar-brand-autodark d-none-navbar-horizontal pe-0 pe-md-3">
                
                </h1>
    
                <div class="nav-item dropdown">
                    <a href="#" class="nav-link d-flex lh-1 text-reset p-0" data-bs-toggle="dropdown" aria-label="Open user menu">
                      <span class="avatar avatar-sm rounded-circle">
                        <svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-user" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
                            <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                            <path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0"></path>
                            <path d="M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2"></path>
                         </svg>
                      </span>
                        <div class="d-none d-xl-block ps-2">
                            <div>User</div>
                        </div>
                    </a>
                    <div class="dropdown-menu dropdown-menu-end dropdown-menu-arrow">
                        <a href="./settings.html" class="dropdown-item">Settings</a>
                        <a href="/logout" class="dropdown-item">Logout</a>
                    </div>
                </div>
        </header>
        <div class="page-wrapper">
            <div class="page-body">
                <div class="container-xl">
                    <div class="row row-deck row-cards">
                        <div class="col-12">
                            <div class="card">
                                <div class="card-body" id="main--card">
                                    <div class="mb-3">
                                        <form hx-get="/search"
                                              hx-target="#response"
                                              hx-swap="innerHTML"
                                              hx-trigger="submit"
                                              class="row g-2">
                                            <div class="dropdown">
                                                <select class="btn dropdown-toggle" id="embeddings" name="embeddings">
                                                    <option value="ad002_rrf" name="embeddings">AdA002 RRF</option>
                                                </select>
                                            </div>
                                            <div class="col">
                                                <input type="text" class="form-control" placeholder="Search for…"
                                                       name="query" id="query" required/>
    
                                                <div id="rrfFields">
                                                    <h4 class="mt-2">Enter these details for RRF search:</h4>
                                                    Metadata Table Name: <input type="text" class="form-control mb-2"
                                                                                placeholder="Metadata Table Name"
                                                                                name="metadataTable" id="metadataTable"/>
                                                    OrderRRF:
                                                    <div class="dropdown mb-2">
                                                        <select class="btn dropdown-toggle" name="orderRRF" id="orderRRF">
                                                            <option value="DEFAULT">DEFAULT</option>
                                                            <option value="TEXT_RANK">TEXT_RANK</option>
                                                            <option value="SIMILARITY">SIMILARITY</option>
                                                            <option value="DATE_RANK">DATE_RANK</option>
                                                        </select>
                                                    </div>
                                                    <span>
                                                        Text-BaseWeight:
                                                        <div class="dropdown mb-2">
                                                            <select class="btn dropdown-toggle" name="textBaseWeight"
                                                                    id="textBaseWeight">
                                                                <option value="1.0">1.0</option>
                                                                <option value="1.25">1.25</option>
                                                                <option value="1.5">1.5</option>
                                                                <option value="1.75">1.75</option>
                                                                <option value="2.0">2.0</option>
                                                                <option value="2.25">2.25</option>
                                                                <option value="2.5">2.5</option>
                                                                <option value="2.75">2.75</option>
                                                                <option value="3.0">3.0</option>
                                                            </select>
                                                        </div>
                                                        </span>
                                                    <div class="mb-4">
                                                        Text-FineTuneWeight:<input type="range" class="form-control-range"
                                                                                   id="textFineTuneWeight"
                                                                                   name="textFineTuneWeight" min="0" max="1"
                                                                                   step="0.01">
                                                        <span id="textFineTuneWeightValue">0.35</span>
                                                    </div>
                                                        Similarity-BaseWeight:
                                                        <div class="dropdown">
                                                            <select class="btn dropdown-toggle mb-2"
                                                                    name="similarityBaseWeight" id="similarityBaseWeight">
                                                                <option value="1.0">1.0</option>
                                                                <option value="1.25">1.25</option>
                                                                <option value="1.5">1.5</option>
                                                                <option value="1.75">1.75</option>
                                                                <option value="2.0">2.0</option>
                                                                <option value="2.25">2.25</option>
                                                                <option value="2.5">2.5</option>
                                                                <option value="2.75">2.75</option>
                                                                <option value="3.0">3.0</option>
                                                            </select>
                                                        </div>
                                                    <div class="mb-4">
                                                        Similarity-FineTuneWeight:<input type="range"
                                                                                         class="form-control-range"
                                                                                         id="similarityFineTuneWeight"
                                                                                         name="similarityFineTuneWeight"
                                                                                         min="0" max="1" step="0.01">
                                                        <span id="similarityFineTuneWeightValue">0.4</span>
                                                    </div>
                                                        Date-BaseWeight:
                                                        <div class="dropdown">
                                                            <select class="btn dropdown-toggle mb-2" name="dateBaseWeight"
                                                                    id="dateBaseWeight">
                                                                <option value="1.0">1.0</option>
                                                                <option value="1.25">1.25</option>
                                                                <option value="1.5">1.5</option>
                                                                <option value="1.75">1.75</option>
                                                                <option value="2.0">2.0</option>
                                                                <option value="2.25">2.25</option>
                                                                <option value="2.5">2.5</option>
                                                                <option value="2.75">2.75</option>
                                                                <option value="3.0">3.0</option>
                                                            </select>
                                                        </div>
                                                    <div class="mb-4">
                                                        Date-FineTuneWeight:<input type="range" class="form-control-range"
                                                                                   id="dateFineTuneWeight"
                                                                                   name="dateFineTuneWeight" min="0" max="1"
                                                                                   step="0.01">
                                                        <span id="dateFineTuneWeightValue">0.75</span>
                                                    </div>
                                                </div>
                                            </div>
                                                <div class="col-auto">
                                                    <button onclick="load()" class="btn btn-icon" aria-label="Button"
                                                            type="submit">
                                                        <svg xmlns="http://www.w3.org/2000/svg" class="icon" width="24"
                                                             height="24" viewBox="0 0 24 24" stroke-width="2"
                                                             stroke="currentColor" fill="none" stroke-linecap="round"
                                                             stroke-linejoin="round">
                                                            <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                                                            <circle cx="10" cy="10" r="7"/>
                                                            <line x1="21" y1="21" x2="15" y2="15"/>
                                                        </svg>
                                                    </button>
                                                </div>
                                        </form>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="col-12">
                            <div class="card">
                                <div class="card-body border overflow-auto placeholder-glow" style="height: 40rem; padding: 0">
                                    <div id="response">
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <script src="https://cdn.jsdelivr.net/npm/@tabler/core@1.0.0-beta17/dist/js/tabler.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/@tabler/core@1.0.0-beta17/dist/js/demo.min.js"></script>
    <script src="https://unpkg.com/htmx.org@1.9.2" integrity="sha384-L6OqL9pRWyyFU3+/bjdSri+iIphTN/bvYyM37tICVyOJkWZLpP2vGn6VUEXgzg6h" crossorigin="anonymous"></script>
    <script>
        function load() {
            if(document.getElementById("query").value === "") return;
            var html = '<div class="text-center">'
                    + '<div class="placeholder col-10"></div>'
                    + '<div class="placeholder col-10"></div>'
                    + '<div class="placeholder col-10"></div>'
                    + '<div class="placeholder col-10"></div>'
                    + '</div>'
                    + '<br>'
                    + '<div class="text-center">'
                    + '<div class="placeholder col-10"></div>'
                    + '<div class="placeholder col-10"></div>'
                    + '<div class="placeholder col-10"></div>'
                    + '<div class="placeholder col-10"></div>'
                    + '</div>'
                    +  '<br>'
                    + '<div class="text-center">'
                    + '<div class="placeholder col-10"></div>'
                    + '<div class="placeholder col-10"></div>'
                    + '<div class="placeholder col-10"></div>'
                    + '<div class="placeholder col-10"></div>'
                    + '</div>'
                    +  '<br>'
                    + '<div class="text-center">'
                    + '<div class="placeholder col-10"></div>'
                    + '<div class="placeholder col-10"></div>'
                    + '<div class="placeholder col-10"></div>'
                    + '<div class="placeholder col-10"></div>'
                    + '</div>'
                    +  '<br>'
                    + '<div class="text-center">'
                    + '<div class="placeholder col-10"></div>'
                    + '<div class="placeholder col-10"></div>'
                    + '<div class="placeholder col-10"></div>'
                    + '<div class="placeholder col-10"></div>'
                    + '</div>';
            document.getElementById("response").innerHTML=html;
        };
    
        var embeddingSelect = document.getElementById('embeddings');
        function setDefaultValues() {
            var rrfFields = document.getElementById('rrfFields');
            var mainCard = document.getElementById('main--card');
            var fieldIds = ['metadataTable', 'orderRRF', 'textBaseWeight', 'textFineTuneWeight', 'similarityBaseWeight', 'similarityFineTuneWeight', 'dateBaseWeight', 'dateFineTuneWeight'];
            if (embeddingSelect.value === 'ad002_rrf' || embeddingSelect.value === 'bgeSmall_rrf') {
                mainCard.style.height = '38rem';
                rrfFields.style.display = 'block';
    
                if (embeddingSelect.value === 'ad002_rrf') {
                    // default values for AdA002 RRF
                    var defaultValues = ['title_metadata', 'DEFAULT', '1.0', '0.35', '1.5', '0.40', '1.25', '0.75'];
                } else if (embeddingSelect.value === 'bgeSmall_rrf') {
                    // default values for BGE Small RRF
                    var defaultValues = ['title_metadata', 'DEFAULT', '1.0', '0.35', '1.5', '0.40', '1.25', '0.75'];
                }
                for (var i = 0; i < fieldIds.length; i++) {
                    document.getElementById(fieldIds[i]).value = defaultValues[i];
                }
    
            } else {
                mainCard.style.height = '7rem';
                rrfFields.style.display = 'none';
            }
        }
        embeddingSelect.addEventListener('change', setDefaultValues);
    
        setDefaultValues();
    
        //Update the slider
        document.getElementById('textFineTuneWeight').oninput = function() {
            document.getElementById('textFineTuneWeightValue').innerHTML = this.value;
        }
    
        document.getElementById('similarityFineTuneWeight').oninput = function() {
            document.getElementById('similarityFineTuneWeightValue').innerHTML = this.value;
        }
    
        document.getElementById('dateFineTuneWeight').oninput = function() {
            document.getElementById('dateFineTuneWeightValue').innerHTML = this.value;
        }
    </script>
    </script>
    </body>
    </html>
`;
export default ExampleLayout;
