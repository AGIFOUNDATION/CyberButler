(() => {
	const SymbUpdate = Symbol('update');
	const DefaultSize = 100;

	class LRUCache {
		constructor (limit=DefaultSize) {
			this.cache = new Map();
			this.secondary = new Map();
			this.limit = isNumber(limit) ? limit : DefaultSize;
			this.length = 0;
		}
		set (k, v) {
			const has = this.cache.has(k);
			if (!has) this[SymbUpdate](k, v);
			else this.cache.set(k, v);
		}
		get (k) {
			var v = this.cache.get(k);
			if (v !== undefined) return v;
			v = this.secondary.get(k);
			if (v !== undefined) this[SymbUpdate](k, v);
			return v;
		}
		del (k) {
			const has = this.cache.has(k);
			if (has) this.length --;
			this.cache.delete(k);
			this.secondary.delete(k);
		}
		has (k) {
			return this.cache.has(k) || this.secondary.has(k);
		}
		clear () {
			this.cache.clear();
			this.secondary.clear();
			this.length = 0;
		}
		[SymbUpdate] (k, v) {
			this.length ++;
			if (this.length >= this.limit) {
				this.secondary = this.cache;
				this.cache = new Map();
				this.length = 0;
			}
			this.cache.set(k, v);
		}
	}

	globalThis.LRUCache = LRUCache;
}) ();