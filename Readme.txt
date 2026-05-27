News Console
============

Web app for connecting to MongoDB news data, running analytics pipelines, and editing OLAP schemas.


Prerequisites
-------------

Install on your machine:

  .NET SDK 10
    https://dotnet.microsoft.com/download
    Backend API

  Node.js (LTS) + npm
    https://nodejs.org/
    Frontend

  SQL Server Express LocalDB
    https://learn.microsoft.com/sql/database-engine/configure-windows/sql-server-express-localdb
    Users, roles, processing jobs (created automatically on first API start)

  MongoDB
    https://www.mongodb.com/try/download/community
    News and analytics data

  Docker Desktop (optional)
    https://www.docker.com/products/docker-desktop/
    Only needed to run processing / OLAP rebuild in containers

  OpenAI API key
    https://platform.openai.com/api-keys
    Pipelines and schema rebuild (set in the app Profile)

Ports used:
  API 5000
  frontend 3000
  MongoDB usually 27017 (the UI default URI uses 27019 - change it on the landing page to match your MongoDB port)

Default admin (created on first backend start):
  Email: test@gmail.com
  Password: Password123#


Quick start (UI + API)
----------------------

From PowerShell:

  cd news-console
  .\start-all.ps1

This opens two terminals: backend and frontend.

  Frontend: http://localhost:3000
  API health: http://localhost:5000/api/health

On first start the API applies database migrations and creates the default admin user.


MongoDB
-------

1. Start MongoDB locally.
2. Open http://localhost:3000 and sign in.
3. On the landing page, enter a connection string, for example:

     mongodb://localhost:27017/diploma

4. Click Test to check the connection.

Import or process news as needed from the UI.


OpenAI API key
--------------

Processing and OLAP rebuild need your OpenAI key:

1. Sign in -> Profile
2. Paste your API key -> Save

If you see a "padding" / decrypt error when rebuilding schemas, save the key again in Profile (it re-encrypts with the current server settings).


Docker pipelines (optional)
---------------------------

Needed only for Start processing on the landing page and Save and Rebuild schemas on the OLAP page.

appsettings.Development.json sets SkipDockerInitiation: true, so start-all.ps1 alone does NOT start Docker jobs. To enable them, set in news-console/backend-new/NewsConsole.Api/appsettings.Development.json:

  "SkipDockerInitiation": false

Then build images once:

  News processing pipeline:
    cd news-console\news-processing-pipeline
    docker build -t news-pipeline:latest .

  OLAP schema rebuild pipeline:
    cd ..\olap-schema-rebuild-pipeline
    .\build-image.ps1

Start Docker Desktop before running processing from the UI.

Image names must match appsettings.json:
  news-pipeline:latest
  olap-schema-rebuild-pipeline:latest


Start parts separately
----------------------

Backend only:

  cd news-console\backend-new\NewsConsole.Api
  dotnet run

Frontend only:

  cd news-console\frontend
  npm install
  npm run dev

News processing pipeline (manual, without UI):

  cd news-console\news-processing-pipeline
  copy .env.example .env
  (edit .env: MONGO_URI, OPENAI_API_KEY)
  pip install -r requirements.txt
  python run_pipeline.py

OLAP rebuild pipeline (manual):

  cd news-console\olap-schema-rebuild-pipeline
  copy .env.example .env
  (edit .env: MONGO_URI, OPENAI_TOKEN)
  pip install -r requirements.txt
  python run_rebuild.py --help


Project layout
--------------

  diploma/
    news-console/          Main application
      backend-new/           .NET API
      frontend/              React + Vite UI
      news-processing-pipeline/
      olap-schema-rebuild-pipeline/
      start-all.ps1
    utils/                   Sample JSON / diagrams
