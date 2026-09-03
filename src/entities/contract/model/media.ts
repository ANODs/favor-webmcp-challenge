export const toggleContractMediaRef = (mediaRefs: string[], imageUrl: string) =>
  mediaRefs.includes(imageUrl)
    ? mediaRefs.filter((item) => item !== imageUrl)
    : [...mediaRefs, imageUrl];

export const setPrimaryContractMediaRef = (mediaRefs: string[], imageUrl: string) => [
  imageUrl,
  ...mediaRefs.filter((item) => item !== imageUrl),
];

export const reconcileContractMediaRefs = (
  selectedMediaRefs: string[],
  previousAvailableMediaRefs: string[] | null,
  nextAvailableMediaRefs: string[],
) => {
  if (!previousAvailableMediaRefs) {
    return [...nextAvailableMediaRefs];
  }

  const nextAvailable = new Set(nextAvailableMediaRefs);
  const previousAvailable = new Set(previousAvailableMediaRefs);

  return [
    ...selectedMediaRefs.filter((item) => nextAvailable.has(item)),
    ...nextAvailableMediaRefs.filter((item) => !previousAvailable.has(item)),
  ];
};
