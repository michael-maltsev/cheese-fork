clone-git-deps:
	git config --global --add safe.directory ${PWD} 
	git submodule update --init --recursive --remote

install-npm-deps: 
	cd ./deploy && npm i

fetch-semesters:
	./deploy.sh

setup-dev-env: clone-git-deps install-npm-deps fetch-semesters