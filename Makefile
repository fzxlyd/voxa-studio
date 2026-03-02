.PHONY: install run test

install:
	python3 -m pip install --upgrade pip
	pip install -r requirements-dev.txt

run:
	uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

test:
	pytest -q
