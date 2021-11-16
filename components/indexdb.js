export default class IndexedDB {
	constructor({
		name,
		version,
		table,
		key,
		callback
	}) {
		this.name = name;
		this.version = version;
		this.table = table;
		this.key = key;
		const request = indexedDB.open(name, version);
		request.onerror = (e) => {
			console.error('db: onerror', e);
			console.error(e);
		};
		request.onsuccess = (e) => {
			console.log('db: onsuccess', request.result);
			this.db = request.result;
			callback && callback();
		};
		request.onupgradeneeded = (e) => {
			console.log('db: onupgradeneeded', request.result);
			this.db = request.result;
			this.addTable(table, key);
		};
		request.onblocked = (e) => {
			console.log('db: onblocked', request.result);
		};
	}
	addTable = (table, key) => {
		const objectStore = this.db.createObjectStore(table, {
			keyPath: key
		});
		objectStore.createIndex(key, key, {
			unique: true
		});
	}
	getAll = () => {
		return new Promise((resolve, reject) => {
			const request = this.db.transaction(this.table)
				.objectStore(this.table)
				.getAll();
			request.onsuccess = function(event) {
				console.log('db: get all', event.target.result)
				resolve(event.target.result);
			};
			request.onerror = function(event) {
				console.error('db: get all', event);
				reject(event);
			};
		});
	}
	getItem = (url) => {
		return new Promise((resolve, reject) => {
			const request = this.db.transaction(this.table)
				.objectStore(this.table)
				.index(this.key)
				.get(url)
			request.onsuccess = function(event) {
				console.log('db: get', event.target.result)
				resolve(event.target.result);
			};
			request.onerror = function(event) {
				console.error('db: get', event);
				reject(event);
			};
		});
	}
	addItem = (data) => {
		return new Promise((resolve, reject) => {
			const request = this.db.transaction(this.table, "readwrite")
				.objectStore(this.table)
				.add(data);
			request.onsuccess = function(event) {
				console.log('db: add', event.target.result)
				resolve(event.target.result);
			};
			request.onerror = function(event) {
				console.error('db: add', event);
				reject(event);
			};
		});
	}
	putItem = (data) => {
		return new Promise((resolve, reject) => {
			const request = this.db.transaction(this.table, "readwrite")
				.objectStore(this.table)
				.put(data)
			request.onsuccess = function(event) {
				console.log('db: put', event.target.result)
				resolve(event.target.result);
			};
			request.onerror = function(event) {
				console.error('db: put', event);
				reject(event);
			};
		});
	}
	deleteItem = (key) => {
		return new Promise((resolve, reject) => {
			const request = this.db.transaction(this.table, "readwrite")
				.objectStore(this.table)
				.delete(key)
			request.onsuccess = function(event) {
				console.log('db: delete', key);
				resolve(event.target.result);
			};
			request.onerror = function(event) {
				console.error('db: delete', event);
				reject(event);
			};
		});
	}
}
