import {
  getState, subscribe, setState, resetState, setError, clearError
} from '../js/state/store.js';

QUnit.module('store.js', hooks => {
  QUnit.test('subscribe/getState/setState triggers on update and unsub', assert => {
    let called = 0;
    let lastState = null;
    const unsub = subscribe((state, patch) => { called++; lastState = state; });
    assert.ok(typeof lastState === 'object', 'Initial call gives state');
    setState({ loading: true });
    assert.equal(getState().loading, true, 'State updated');
    assert.equal(lastState.loading, true, 'Subscriber got update');
    unsub();
    setState({ loading: false });
    assert.equal(called, 2, 'Unsub worked');
  });

  QUnit.test('setState and resetState patch shallow and nested state', assert => {
    resetState({ prompts: [1,2,3], filter: { category: 'A' }, paging: { page: 7 }, loading: false });
    setState({ filter: { tag: 'test' }, paging: { totalFiltered: 11 } });
    const s = getState();
    assert.equal(s.prompts.length, 3, 'Prompts in state');
    assert.equal(s.filter.category, 'A', 'Filter (category) kept');
    assert.equal(s.filter.tag, 'test', 'Filter (tag) patched');
    assert.equal(s.paging.page, 7, 'Paging (page) kept');
    assert.equal(s.paging.totalFiltered, 11, 'Paging (totalFiltered) patched');
  });

  QUnit.test('setError and clearError notify subscribers and update error state', assert => {
    let errorState = null;
    const unsub = subscribe((st, patch) => { if ('lastError' in patch) errorState = st.lastError; });
    setError({ type: 'fail', message: 'Bad', details: {some:1} });
    assert.deepEqual(errorState, { type: 'fail', message: 'Bad', details: {some:1}, fallbackAction: null }, 'Error set');
    clearError();
    assert.equal(errorState, null, 'Error cleared');
    unsub();
  });
});