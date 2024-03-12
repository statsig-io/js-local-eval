import StickyValuesStorage from '../utils/StickyValuesStorage';

jest.mock('../utils/EvaluationUtils', () => ({
  getUnitID: jest.fn().mockReturnValue('user123'),
}));

const mockLoad = jest.fn();
const mockSave = jest.fn();
const mockLoadAsync = jest.fn();

const mockStorageInterface = {
  load: mockLoad,
  save: mockSave,
  loadAsync: mockLoadAsync,
};

describe('StickyValuesStorage', () => {
  const user = { userID: 'testUserID' };
  const idType = 'userID';
  const storageKey = 'user123:userID';
  const userStickyValues = {
    example_experiment: {
      value: true,
      rule_id: 'testRuleID',
      json_value: { key: 'value' },
      secondary_exposures: [],
      group_name: 'testGroupName',
      time: 12345,
    },
  };

  beforeEach(() => {
    (StickyValuesStorage as any).storageInterface = mockStorageInterface;
    mockLoad.mockClear();
    mockSave.mockClear();
    mockLoadAsync.mockClear();
    // @ts-ignore
    StickyValuesStorage.inMemoryCache = {};
  });

  describe('getAll', () => {
    it('returns null if storageInterface is null', () => {
      StickyValuesStorage.storageInterface = null;
      const result = StickyValuesStorage.getAll(user, idType);
      expect(result).toBeNull();
    });
  });

  describe('getAsync', () => {
    it('returns null if storageInterface is null', async () => {
      StickyValuesStorage.storageInterface = null;
      const result = await StickyValuesStorage.getAsync(user, idType);
      expect(result).toBeNull();
    });
  });

  describe('save', () => {
    it('does nothing if storageInterface is null', () => {
      StickyValuesStorage.storageInterface = null;
      StickyValuesStorage.save(
        user,
        idType,
        'example_experiment',
        userStickyValues.example_experiment,
      );
      expect(mockSave).not.toHaveBeenCalled();
    });

    it('saves value to persistent storage', () => {
      StickyValuesStorage.save(
        user,
        idType,
        'example_experiment',
        userStickyValues.example_experiment,
      );
      expect(mockSave).toHaveBeenCalledWith(
        storageKey,
        'example_experiment',
        JSON.stringify(userStickyValues.example_experiment),
      );
    });
  });
});
