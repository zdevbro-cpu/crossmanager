function i(e,n){if(e&&n){const t=new Date(e),a=new Date(n);if(t>a)return"시작일은 종료일보다 늦을 수 없습니다."}return null}function r(e){return Number.isNaN(e)||e<=0?"금액은 0보다 커야 합니다.":null}export{i as a,r as v};
