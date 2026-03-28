.PHONY: build deploy unit e2e test

build:
	npm run build

deploy:
	npm run deploy

unit:
	npm run test:all

e2e:
	npm run test:e2e

test: unit e2e
